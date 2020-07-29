(function (BaseInput) {

    "use strict";

    window["BaseInput"] = BaseInput;

})((function ($) {

    "use strict";

    class BaseInput {
        constructor(input) {
            this.input = input;
            this.separator = '';
            this.usedTerms = [];
            this.completer = null;
            this.lastCompletedTerm = null;
            this._termInput = null;
            this._termContainer = null;
        }

        get termInput() {
            if (this._termInput === null) {
                this._termInput = document.querySelector(this.input.dataset.termInput);
            }

            return this._termInput;
        }

        get termContainer() {
            if (this._termContainer === null) {
                this._termContainer = document.querySelector(this.input.dataset.termContainer);
            }

            return this._termContainer;
        }

        bind() {
            let $form = $(this.input.form);

            // Form submissions
            $form.on('submit', this.onSubmit, this);
            $form.on('click', 'button, input[type="submit"]', this.onButtonClick, this);

            // User interactions
            $form.on('input', '[data-term-label]', this.onInput, this);
            $form.on('keydown', '[data-term-label]', this.onKeyDown, this);
            $form.on('keyup', '[data-term-label]', this.onKeyUp, this);
            $form.on('focusout', '[data-term-index]', this.onTermBlur, this);

            // Should terms be completed?
            if (this.input.dataset.termCompletion) {
                if (this.completer === null) {
                    this.completer = new Completer(this.input, true);
                    this.completer.bind();
                }

                $form.on('suggestion', '[data-term-label]', this.onSuggestion, this);
                $form.on('completion', '[data-term-label]', this.onCompletion, this);
            }

            return this;
        }

        refresh(input) {
            if (input === this.input) {
                // If the DOM node is still the same, nothing has changed
                return;
            }

            this._termInput = null;
            this._termContainer = null;

            this.input = input;
            this.bind();

            if (this.completer !== null) {
                this.completer.refresh(input);
            }

            if (! this.restoreTerms()) {
                this.reset();
            }
        }

        reset() {
            this.usedTerms = [];
            this.lastCompletedTerm = null;

            this.togglePlaceholder();
            this.termInput.value = '';
            this.termContainer.innerHTML = '';
        }

        destroy() {
            this._termContainer = null;
            this._termInput = null;
            this.input = null;

            if (this.completer !== null) {
                this.completer.destroy();
                this.completer = null;
            }
        }

        restoreTerms() {
            if (this.hasTerms()) {
                this.usedTerms.forEach((termData, termIndex) => this.addTerm(termData, termIndex));
                this.togglePlaceholder();
                this.writePartialTerm('', this.input);
            } else {
                this.registerTerms();
                this.togglePlaceholder();
            }

            return this.hasTerms();
        }

        registerTerms() {
            this.termContainer.childNodes.forEach((label) => {
                let termData = {
                    'search': label.dataset.termSearch,
                    'label' : label.dataset.termLabel
                };
                if (label.className) {
                    termData['class'] = label.className;
                }

                this.registerTerm(termData, label.dataset.termIndex);
            });
        }

        registerTerm(termData, termIndex = null) {
            if (termIndex !== null) {
                this.usedTerms[termIndex] = termData;
                return termIndex;
            } else {
                return this.usedTerms.push(termData) - 1;
            }
        }

        writePartialTerm(value, input) {
            input.value = value;
            this.updateTermData({ label: value }, input);
        }

        readPartialTerm(input) {
            return input.value.trim();
        }

        readFullTerm(input, termIndex = null) {
            let value = this.readPartialTerm(input);
            if (! value) {
                return false;
            }

            let termData = {};

            if (termIndex !== null) {
                termData = { ...this.usedTerms[termIndex] };
            }

            termData.label = value;
            termData.search = value;

            if (this.lastCompletedTerm !== null) {
                if (termData.label === this.lastCompletedTerm.label) {
                    termData.search = this.lastCompletedTerm.search;
                    termData.class = this.lastCompletedTerm.class;
                }

                this.lastCompletedTerm = null;
            }

            return termData;
        }

        exchangeTerm() {
            let termData = this.readFullTerm(this.input);
            if (! termData) {
                return false;
            }

            if (this.completer !== null) {
                this.completer.reset();
            }

            this.addTerm(termData);
            this.writePartialTerm('', this.input);

            return true;
        }

        addTerm(termData, termIndex = null) {
            if (termIndex === null) {
                termIndex = this.registerTerm(termData);
            }

            let existingTerms = this.termInput.value;
            if (existingTerms) {
                existingTerms += this.separator;
            }

            existingTerms += termData.search;
            this.termInput.value = existingTerms;

            this.termContainer.appendChild(this.renderTerm(termData, termIndex));
        }

        hasTerms() {
            return this.usedTerms.length > 0;
        }

        saveTerm(input) {
            let termIndex = input.parentNode.dataset.termIndex;
            let termData = this.readFullTerm(input, termIndex);

            // Only save if something has changed
            if (this.usedTerms[termIndex].label !== termData.label) {
                this.usedTerms[termIndex] = termData;
                this.termInput.value = this.usedTerms.map(e => e.search).join(this.separator).trim();
                this.updateTermData(termData, input);
            }
        }

        updateTermData(termData, input) {
            let label = input.parentNode;
            label.dataset.termLabel = termData.label;

            if (!! termData.search || termData.search === '') {
                label.dataset.termSearch = termData.search;
            }
        }

        lastTerm() {
            if (! this.hasTerms()) {
                return null;
            }

            return this.usedTerms[this.usedTerms.length - 1];
        }

        popTerm() {
            if (this.termContainer.hasChildNodes()) {
                this.removeTerm(this.termContainer.lastChild);

                if (this.completer !== null) {
                    this.completer.abort();
                }
            }
        }

        removeTerm(label) {
            // Cut the term's data
            this.usedTerms.splice(label.dataset.termIndex, 1);

            // Re-index following remaining terms
            let sibling = label.nextSibling;
            while (sibling !== null) {
                sibling.dataset.termIndex -= 1;
                sibling = sibling.nextSibling;
            }

            // Update the hidden input
            this.termInput.value = this.usedTerms.map(e => e.search).join(this.separator).trim();

            // Remove it from the DOM
            label.remove();
        }

        complete(data, input) {
            if (this.completer !== null) {
                $(input).trigger('complete', data);
            }
        }

        selectTerms() {
            this.termContainer.childNodes.forEach(e => e.classList.add('selected'));
        }

        deselectTerms() {
            this.termContainer.childNodes.forEach(e => e.classList.remove('selected'));
        }

        clearSelectedTerms() {
            if (this.hasTerms()) {
                this.termContainer.querySelectorAll('.selected').forEach(el => this.removeTerm(el));
            }
        }

        togglePlaceholder() {
            let placeholder = '';

            if (! this.hasTerms()) {
                if (this.input.dataset.placeholder) {
                    placeholder = this.input.dataset.placeholder;
                } else {
                    return;
                }
            } else if (this.input.placeholder) {
                if (! this.input.dataset.placeholder) {
                    this.input.dataset.placeholder = this.input.placeholder;
                }
            }

            this.input.placeholder = placeholder;
        }

        renderTerm(termData, termIndex) {
            let template = document.createElement('template');
            template.innerHTML = '<label><input type="text"></label>';
            let label = template.content.firstChild;

            if (termData.class) {
                label.classList.add(termData.class);
            }

            label.dataset.termLabel = termData.label;
            label.dataset.termSearch = termData.search;
            label.dataset.termIndex = termIndex;

            label.firstChild.value = termData.label;

            return label;
        }

        // TODO: Use for what?
        dataFromTermData(termData) {
            let data = {};
            for (let key in termData) {
                data['term' + key[0].toUpperCase() + key.slice(1)] = termData[key];
            }

            return data;
        }

        termDataFromData(data) {
            let termData = {};
            for (let key in data) {
                if (key.slice(0, 4) === 'term') {
                    let firstChar = key[4];
                    termData[firstChar.toLowerCase() + key.slice(5)] = data[key];
                }
            }

            return termData;
        }

        moveFocusForward() {
            let focused = this.termContainer.querySelector('input:focus');
            if (focused !== null) {
                let inputs = Array.from(this.termContainer.querySelectorAll('input'));
                let next = inputs[inputs.indexOf(focused) + 1];
                if (next) {
                    $(next).focus();
                } else {
                    $(this.input).focus();
                }
            } else {
                $(this.termContainer.firstChild).focus();
            }
        }

        moveFocusBackward() {
            let focused = this.termContainer.querySelector('input:focus');
            if (focused !== null) {
                let inputs = Array.from(this.termContainer.querySelectorAll('input'));
                let previous = inputs[inputs.indexOf(focused) - 1];
                if (previous) {
                    $(previous).focus();
                } else {
                    $(this.input).focus();
                }
            } else {
                $(this.termContainer.lastChild).focus();
            }
        }

        /**
         * Event listeners
         */

        onSubmit(event) {
            // TODO: This omits incomplete quoted terms. Since it seems not to be possible to prevent submission
            // in this case we'll need some workaround here. Maybe using the incomplete term anyway?
            this.exchangeTerm();

            // Unset the input's name, to prevent its submission (It may actually have a name, as no-js fallback)
            this.input.name = '';

            // Enable the hidden input, otherwise it's not submitted
            this.termInput.disabled = false;
        }

        onSuggestion(event) {
            let data = event.detail;
            let input = event.target;

            let termData;
            if (typeof data === 'object') {
                termData = this.termDataFromData(data);
            } else {
                termData = { label: data, search: data };
            }

            this.lastCompletedTerm = termData;
            this.writePartialTerm(termData.label, input);

            if (input === document.activeElement) {
                // If the input is focused, complete the new value just like we do it for user-input
                this.complete({ ...termData }, input);
            }
        }

        onCompletion(event) {
            let input = event.target;
            let isTerm = input.parentNode.dataset.termIndex >= 0;

            let termData = this.termDataFromData(event.detail);

            this.lastCompletedTerm = termData;
            this.writePartialTerm(termData.label, input);

            if (! isTerm) {
                this.exchangeTerm();
            }
        }

        onInput(event) {
            let input = event.target;
            let isTerm = input.parentNode.dataset.termIndex >= 0;

            let termData = { label: input.value };
            this.updateTermData(termData, input);
            this.complete(termData, input);

            if (! isTerm) {
                this.clearSelectedTerms();
                this.togglePlaceholder();
            }
        }

        onKeyDown(event) {
            let input = event.target;
            let isTerm = input.parentNode.dataset.termIndex >= 0;

            switch (event.key) {
                case 'Backspace':
                    if (! isTerm) {
                        this.clearSelectedTerms();

                        if (! input.value) {
                            this.popTerm();
                        }

                        this.togglePlaceholder();
                    }
                    break;
                case 'Enter':
                    if (isTerm) {
                        this.saveTerm(input);
                    }
                    break;
                case 'ArrowLeft':
                    if (input.selectionStart === 0 && this.hasTerms()) {
                        event.preventDefault();
                        this.moveFocusBackward();
                    }
                    break;
                case 'ArrowRight':
                    if (input.selectionStart === input.value.length && this.hasTerms()) {
                        event.preventDefault();
                        this.moveFocusForward();
                    }
                    break;
            }
        }

        onKeyUp(event) {
            if (event.target.parentNode.dataset.termIndex >= 0) {
                return;
            }

            switch (event.key) {
                case 'End':
                case 'ArrowLeft':
                case 'ArrowRight':
                    this.deselectTerms();
                    break;
                case 'Home':
                    if (event.shiftKey) {
                        this.selectTerms();
                    }
                    break;
                case 'Delete':
                    this.clearSelectedTerms();
                    this.togglePlaceholder();
                    break;
                case 'a':
                    if (event.ctrlKey || event.metaKey) {
                        this.selectTerms();
                    }
                    break;
            }
        }

        onTermBlur(event) {
            this.saveTerm(event.target);
        }

        onButtonClick(event) {
            if (! this.input.dataset.manageRequired) {
                return;
            }

            let button = event.currentTarget;
            if (button.type === 'submit' || (button.tagName === 'button' && ! button.type)) {
                if (this.hasTerms()) {
                    this.input.required = false;
                } else if (! this.input.required) {
                    this.input.required = true;
                }
            }
        }
    }

    return BaseInput;
})(notjQuery));