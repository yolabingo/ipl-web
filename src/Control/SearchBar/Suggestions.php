<?php

namespace ipl\Web\Control\SearchBar;

use Countable;
use Icinga\Data\Filter\FilterChain;
use ipl\Html\BaseHtmlElement;
use ipl\Html\FormElement\ButtonElement;
use ipl\Html\FormElement\InputElement;
use ipl\Html\HtmlElement;
use ipl\Stdlib\Contract\Paginatable;
use IteratorIterator;
use LimitIterator;
use OuterIterator;
use Traversable;

class Suggestions extends BaseHtmlElement
{
    const DEFAULT_LIMIT = 50;

    protected $tag = 'ul';

    /** @var string */
    protected $searchTerm;

    /** @var Traversable */
    protected $data;

    /** @var array */
    protected $default;

    /** @var string */
    protected $type;

    public function setSearchTerm($term)
    {
        $this->searchTerm = $term;

        return $this;
    }

    public function setData($data)
    {
        $this->data = $data;

        return $this;
    }

    public function setDefault($default)
    {
        $this->default = $default;

        return $this;
    }

    public function setType($type)
    {
        $this->type = $type;

        return $this;
    }

    protected function filterToTerms(FilterChain $filter)
    {
        $logicalSep = [
            'label'     => $filter->getOperatorSymbol(),
            'search'    => $filter->getOperatorSymbol(),
            'class'     => 'logical_operator',
            'type'      => 'logical_operator'
        ];

        $terms = [];
        foreach ($filter->filters() as $child) {
            if ($child->isChain()) {
                $terms[] = [
                    'search'    => '(',
                    'label'     => '(',
                    'type'      => 'grouping_operator',
                    'class'     => 'grouping_operator_open'
                ];
                $terms = array_merge($terms, $this->filterToTerms($child));
                $terms[] = [
                    'search'    => ')',
                    'label'     => ')',
                    'type'      => 'grouping_operator',
                    'class'     => 'grouping_operator_close'
                ];
            } else {
                $terms[] = [
                    'search'    => $child->getColumn(),
                    'label'     => $child->metaData['label'],
                    'type'      => 'column'
                ];
                $terms[] = [
                    'search'    => $child->getSign(),
                    'label'     => $child->getSign(),
                    'type'      => 'operator'
                ];
                $terms[] = [
                    'search'    => $child->getExpression(),
                    'label'     => $child->getExpression(),
                    'type'      => 'value'
                ];
            }

            $terms[] = $logicalSep;
        }

        array_pop($terms);
        return $terms;
    }

    protected function assembleDefault()
    {
        if ($this->default === null) {
            return;
        }

        $attributes = [
            'type'          => 'button',
            'tabindex'      => -1,
            'data-label'    => $this->default['search'],
            'value'         => $this->default['search']
        ];
        if (isset($this->default['type'])) {
            $attributes['data-type'] = $this->default['type'];
        } elseif ($this->type !== null) {
            $attributes['data-type'] = $this->type;
        }

        $button = new ButtonElement(null, $attributes);
        $button->add([
            sprintf('%s ', t('Search for')),
            new HtmlElement('em', null, $this->default['search'])
        ]);
        if (isset($this->default['type']) && $this->default['type'] === 'terms') {
            $terms = $this->filterToTerms($this->default['terms']);
            $list = new HtmlElement('ul', ['class' => 'comma-separated']);
            foreach ($terms as $data) {
                if ($data['type'] === 'column') {
                    $list->add(new HtmlElement('li', null, [
                        new HtmlElement('em', null, $data['label'])
                    ]));
                }
            }

            $button->setAttribute('data-terms', json_encode($terms));
            $button->add([
                sprintf(' %s ', t('in:')),
                $list
            ]);
        }

        $this->prepend(new HtmlElement('li', ['class' => 'default'], $button));
    }

    protected function assemble()
    {
        if ($this->data instanceof Paginatable) {
            $this->data->limit(self::DEFAULT_LIMIT);
            $data = $this->data;
        } else {
            $data = new LimitIterator(new IteratorIterator($this->data), 0, self::DEFAULT_LIMIT);
        }

        foreach ($data as $term => $meta) {
            if (is_int($term)) {
                $term = $meta;
            }

            $attributes = [
                'type'          => 'button',
                'tabindex'      => -1,
                'data-search'   => $term
            ];
            if ($this->type !== null) {
                $attributes['data-type'] = $this->type;
            }

            if (is_array($meta)) {
                foreach ($meta as $key => $value) {
                    if ($key === 'label') {
                        $attributes['value'] = $value;
                    }

                    $attributes['data-' . $key] = $value;
                }
            } else {
                $attributes['value'] = $meta;
                $attributes['data-label'] = $meta;
            }

            $this->add(new HtmlElement('li', null, new InputElement(null, $attributes)));
        }

        if ($this->hasMore($data, self::DEFAULT_LIMIT)) {
            $this->getAttributes()->add('class', 'has-more');
        }

        $showDefault = true;
        if ($this->searchTerm && $this->count() === 1) {
            // The default option is only shown if the user's input does not result in an exact match
            $input = $this->getFirst('li')->getFirst('input');
            $showDefault = $input->getValue() != $this->searchTerm
                && $input->getAttributes()->get('data-search')->getValue() != $this->searchTerm;
        }

        if ($showDefault) {
            $this->assembleDefault();
        }
    }

    protected function hasMore($data, $than)
    {
        if (is_array($data)) {
            return count($data) > $than;
        } elseif ($data instanceof Countable) {
            return $data->count() > $than;
        } elseif ($data instanceof OuterIterator) {
            return $this->hasMore($data->getInnerIterator(), $than);
        }

        return false;
    }

    public function renderUnwrapped()
    {
        $this->ensureAssembled();

        if ($this->isEmpty()) {
            return '';
        }

        return parent::renderUnwrapped();
    }
}