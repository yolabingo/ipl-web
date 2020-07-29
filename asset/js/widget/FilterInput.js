(function (FilterInput) {

    "use strict";

    window["FilterInput"] = FilterInput;

})((function (BaseInput) {

    "use strict";

    class FilterInput extends BaseInput {
        /**
         * Supported grouping operators
         *
         * @type {{close: {}, open: {}}}
         */
        grouping_operators = {
            open: { label: '(', search: '(', class: 'grouping_operator_open', type: 'grouping_operator' },
            close: { label: ')', search: ')', class: 'grouping_operator_close', type: 'grouping_operator' }
        };

        /**
         * Supported logical operators
         *
         * The first is also the default.
         *
         * @type {{}[]}
         */
        logical_operators = [
            { label: '&', search: '&', class: 'logical_operator', type: 'logical_operator' },
            { label: '|', search: '|', class: 'logical_operator', type: 'logical_operator' },
        ];

        /**
         * Supported relational operators
         *
         * The first is also the default.
         *
         * @type {{}[]}
         */
        relational_operators = [
            { label: '=', search: '=', class: 'operator', type: 'operator' },
            { label: '!=', search: '!=', class: 'operator', type: 'operator' },
            { label: '>', search: '>', class: 'operator', type: 'operator' },
            { label: '<', search: '<', class: 'operator', type: 'operator' },
            { label: '>=', search: '>=', class: 'operator', type: 'operator' },
            { label: '<=', search: '<=', class: 'operator', type: 'operator' }
        ];

        constructor(input) {
            super(input)

            this.termType = 'column';
            this.previewedTerm = null;
        }

        reset() {
            super.reset();

            this.termType = 'column';
            this.previewedTerm = null;
        }

        restoreTerms() {
            if (super.restoreTerms()) {
                this.reportValidity(this.input.form);
                return true;
            }

            return false;
        }

        registerTerms() {
            super.registerTerms();

            if (this.hasTerms()) {
                this.termType = this.nextTermType(this.lastTerm());
                this.togglePreview(); // TODO: Shouldn't this also be explicitly necessary?
            }
        }

        registerTerm(termData, termIndex = null) {
            if (termIndex !== null) {
                let label = this.termContainer.querySelector('[data-term-index="' + termIndex + '"]');
                termData.type = label.dataset.termType;
            }

            return super.registerTerm(termData, termIndex);
        }

        readFullTerm(input, termIndex = null) {
            let termData = super.readFullTerm(input, termIndex);
            if (termData === false) {
                return false;
            }

            if (! termData.type) {
                termData.type = this.termType;
            }

            if (termData.type === 'column' || termData.type === 'value') {
                termData.search = this.escapeExpression(termData.search);
            }

            return termData;
        }

        addTerm(termData, termIndex = null) {
            super.addTerm(termData, termIndex);

            this.termType = this.nextTermType(termData);
            this.togglePreview(); // TODO: Shouldn't this also be explicitly necessary?
        }

        saveTerm(input) {
            if (! this.checkValidity(input)) {
                return false;
            }

            return super.saveTerm(input);
        }

        removeTerm(label) {
            super.removeTerm(label);

            if (this.hasTerms()) {
                this.termType = this.nextTermType(this.lastTerm());
            } else {
                this.termType = 'column';
            }

            this.togglePreview();
        }

        complete(data, input) {
            let termIndex = input.parentNode.dataset.termIndex;
            if (termIndex) {
                data.type = this.usedTerms[termIndex].type;
            } else {
                termIndex = this.usedTerms.length;
                data.type = this.termType;
            }

            switch (data.type) {
                case 'value':
                    data.operator = this.usedTerms[--termIndex].search;
                case 'operator':
                    data.column = this.usedTerms[--termIndex].search;
            }

            super.complete(data, input);
        }

        nextTermType(termData) {
            switch (termData.type) {
                case 'column':
                    return 'operator';
                case 'operator':
                    return 'value';
                case 'value':
                    return 'logical_operator';
                case 'logical_operator':
                    return 'column';
                case 'grouping_operator':
                    if (termData === this.grouping_operators.open) {
                        return 'column';
                    } else { // if (termData === this.grouping_operators.close) {
                        return 'logical_operator';
                    }
            }
        }

        nextOperator(value, termType = null, termIndex = null) {
            let operators = [],
                partialMatch = false;

            if (termType === null) {
                termType = this.termType;
            }

            switch (termType) {
                case 'column':
                    if (! this.readPartialTerm(this.input)) {
                        if (! this.hasTerms() || this.lastTerm().type === 'logical_operator') {
                            operators.push(this.grouping_operators.open);
                        }

                        break;
                    }
                case 'operator':
                    if (value) {
                        this.relational_operators.forEach((op) => {
                            if (op.label.length > value.length && value === op.label.slice(0, value.length)) {
                                operators.push(op);
                                partialMatch = true;
                            }
                        });
                    }
                    if (! partialMatch) {
                        operators = operators.concat(this.relational_operators);
                    }
                case 'value':
                case 'logical_operator':
                    operators.push(this.grouping_operators.close);
                    operators = operators.concat(this.logical_operators);
                    break;
                case 'grouping_operator':
                    if (termIndex !== null) {
                        let previousTerm = this.usedTerms[termIndex - 1];
                        switch (previousTerm.type) {
                            case 'column':
                            case 'operator':
                            case 'value':
                                operators.push(this.grouping_operators.close);
                                break;
                            case 'logical_operator':
                                operators.push(this.grouping_operators.open);
                                break;
                            case 'grouping_operator':
                                operators.push(previousTerm);
                        }
                    }
            }

            if (! partialMatch && value) {
                let exactMatch = operators.find(op => value === op.label);
                if (exactMatch) {
                    return [ exactMatch ];
                }
            }

            operators.partialMatches = partialMatch;
            return operators;
        }

        checkValidity(input, type = null, termIndex = null) {
            if (type === null) {
                type = input.parentNode.dataset.termType;
            }

            if (termIndex === null && input.parentNode.dataset.termIndex >= 0) {
                termIndex = input.parentNode.dataset.termIndex;
            }

            let value = input.value;

            let options;
            switch (type) {
                case 'operator':
                case 'logical_operator':
                case 'grouping_operator':
                    options = this.nextOperator(value, type, termIndex);
                    break;
                default:
                    return true;
            }

            if (! value || options.partialMatches || (options.length === 1 && options[0].label === value)) {
                input.setCustomValidity('');
            } else {
                input.setCustomValidity(
                    this.input.dataset.chooseTemplate.replace(
                        '%s',
                        options.map(e => e.label).join(', ')
                    )
                );
            }

            return input.checkValidity();
        }

        reportValidity(element) {
            setTimeout(() => element.reportValidity(), 0);
        }

        togglePreview() {
            if (this.input.nextSibling !== null) {
                this.input.nextSibling.remove();
            }

            switch (this.termType) {
                case 'operator':
                    this.previewedTerm = this.relational_operators[0];
                    break;
                case 'logical_operator':
                    this.previewedTerm = this.logical_operators[0];
                    break;
                default:
                    this.previewedTerm = null;
            }

            if (this.previewedTerm !== null) {
                this.input.after(this.renderPreview(this.previewedTerm.label));
            }
        }

        updatePreview() {
            this.input.nextSibling.innerText = this.previewedTerm.label;
        }

        renderPreview(content) {
            let template = document.createElement('template');
            template.innerHTML = '<span>' + content + '</span>';
            return template.content.firstChild;
        }

        renderTerm(termData, termIndex) {
            let label = super.renderTerm(termData, termIndex);
            label.dataset.termType = termData.type;

            return label;
        }

        escapeExpression(expr) {
            return encodeURIComponent(expr).replace(
                /[()]/g,
                function(c) {
                    return '%' + c.charCodeAt(0).toString(16);
                }
            );
        }

        /**
         * Event listeners
         */

        onKeyDown(event) {
            super.onKeyDown(event);
            if (event.defaultPrevented) {
                return;
            }

            let input = event.target;
            let isTerm = input.parentNode.dataset.termIndex >= 0;

            switch (event.key) {
                case ' ':
                    if (! input.value) {
                        if (this.previewedTerm !== null) {
                            this.addTerm(this.previewedTerm);
                        }

                        this.complete({}, input);
                        event.preventDefault();
                    }
                    break;
                case 'Tab':
                    if (! isTerm && this.previewedTerm !== null) {
                        this.addTerm(this.previewedTerm);
                        this.togglePlaceholder();
                        event.preventDefault();
                    }
                    break;
                case 'ArrowUp':
                    if (this.previewedTerm !== null) {
                        let operators;
                        switch (this.previewedTerm.type) {
                            case 'operator':
                                operators = this.relational_operators;
                                break;
                            case 'logical_operator':
                                operators = this.logical_operators;
                                break;
                        }

                        let operatorIndex = operators.indexOf(this.previewedTerm) - 1;
                        if (operatorIndex === -1) {
                            operatorIndex = operators.length - 1;
                        }

                        this.previewedTerm = operators[operatorIndex];
                        this.updatePreview();
                    }
                    break;
                case 'ArrowDown':
                    if (this.previewedTerm !== null) {
                        let operators;
                        switch (this.previewedTerm.type) {
                            case 'operator':
                                operators = this.relational_operators;
                                break;
                            case 'logical_operator':
                                operators = this.logical_operators;
                                break;
                        }

                        let operatorIndex = operators.indexOf(this.previewedTerm) + 1;
                        if (operatorIndex === operators.length) {
                            operatorIndex = 0;
                        }

                        this.previewedTerm = operators[operatorIndex];
                        this.updatePreview();
                    }
                    break;
                default:
                    if (isTerm) {
                        break;
                    } else if (/[A-Z]/.test(event.key.charAt(0))) {
                        // Ignore control keys not resulting in new input data
                        // TODO: Remove this and move the entire block into `onInput`
                        //       once Safari supports `InputEvent.data`
                        break;
                    }

                    let value = event.key;
                    if (this.termType === 'operator') {
                        value = this.readPartialTerm(input) + value;
                    }

                    let operators = this.nextOperator(value);
                    if (operators.partialMatches) {
                        this.exchangeTerm();
                        this.togglePlaceholder();
                    } else if (operators.length === 1 && operators[0].label === value) {
                        if (this.termType !== operators[0].type) {
                            this.exchangeTerm();
                        } else {
                            this.writePartialTerm('', input);
                        }

                        this.addTerm(operators[0]);
                        this.togglePlaceholder();
                        event.preventDefault();
                    }
            }
        }

        onInput(event) {
            let input = event.target;

            if (! this.checkValidity(input)) {
                this.reportValidity(input);
                return;
            }

            let isTerm = input.parentNode.dataset.termIndex >= 0;

            let value = this.readPartialTerm(input);
            if (value && input.checkValidity()) {
                if (! isTerm && this.previewedTerm !== null && this.hasTerms()) {
                    if (this.nextOperator(value).partialMatches) {
                        // TODO: Quickfix, the preview should accordingly adjust if there are partial matches
                        return;
                    }

                    if (value !== this.previewedTerm.label) {
                        this.addTerm(this.previewedTerm);
                        this.togglePlaceholder();
                    } else {
                        this.exchangeTerm();
                        this.togglePlaceholder();
                    }
                }
            }

            super.onInput(event);
        }
    }

    return FilterInput;
})(BaseInput));