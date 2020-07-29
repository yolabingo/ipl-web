(function (notjQuery) {

    "use strict";

    window["notjQuery"] = notjQuery;

})((function () {

    "use strict";

    class notjQuery {
        /**
         * Create a new notjQuery object
         *
         * @param {Element} element
         */
        constructor(element) {
            this.element = element;
        }

        /**
         * Add an event listener to the element
         *
         * @param {string} type
         * @param {string} selector
         * @param {function} handler
         * @param {object} context
         */
        on(type, selector, handler, context = null) {
            if (typeof selector === 'function') {
                context = handler;
                handler = selector;
                selector = null;
            }

            if (selector === null) {
                this.element.addEventListener(type, e => {
                    if (context === null) {
                        handler.apply(e.currentTarget, [e]);
                    } else {
                        handler.apply(context, [e]);
                    }
                });
            } else {
                this.element.addEventListener(type, e => {
                    let currentParent = e.currentTarget.parentNode;
                    for (let target = e.target; target && target !== currentParent; target = target.parentNode) {
                        if (target.matches(selector)) {
                            if (context === null) {
                                handler.apply(target, [e]);
                            } else {
                                handler.apply(context, [e]);
                            }

                            break;
                        }
                    }
                }, false);
            }
        }

        /**
         * Trigger a custom event on the element, asynchronously
         *
         * The event will bubble and is not cancelable.
         *
         * @param {string} type
         * @param {{}} detail
         */
        trigger(type, detail = {}) {
            setTimeout(() => {
                this.element.dispatchEvent(new CustomEvent(type, {
                    cancelable: false,
                    bubbles: true,
                    detail: detail
                }));
            }, 0);
        }

        /**
         * Focus the element
         */
        focus() {
            // Put separately on the event loop because focus() forces layout.
            setTimeout(() => this.element.focus(), 0);
        }
    }

    /**
     * Return a notjQuery object for the given element
     *
     * @param {Element} element
     * @return {notjQuery}
     */
    let factory = function (element) {
        return new notjQuery(element);
    }
    factory.prototype = Object.create(notjQuery.prototype);

    return factory;
})());