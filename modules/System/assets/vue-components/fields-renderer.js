import { FieldTypes } from "../js/settings.js"

let FieldRenderer = {

    data() {

        if (this.modelValue === undefined) {

            let val =  null;

            if (this.field.opts) {

                val = (!this.locale && this.field.opts.default !== undefined && this.field.opts.default) || null;

                if (this.locale && this.field.opts[`default_${this.locale}`]) {
                    val = this.field.opts[`default_${this.locale}`];
                }
            }

            this.$emit('update:modelValue', val);
        }

        return {
            val: this.modelValue,
            fieldItem: null,
            fieldTypes: null,
        }
    },

    props: {
        modelValue: {
            default: undefined
        },
        field: {
            default: null
        },
        locale: {
            default: null
        }
    },

    watch: {
        val: {
            handler() {
                this.update()
            },
            deep: true
        },
        modelValue() {
            this.val = this.modelValue;
            this.update();
        }
    },

    mounted() {
        FieldTypes.get().then(types => {
            this.fieldTypes = types;
        });
    },

    methods: {

        getFieldType() {

            if (VueView.components[`field-${this.field.type}`]) return `field-${this.field.type}`
            if (VueView.components[this.field.type]) return this.field.type;
            return 'field-object';
        },

        addFieldItem(field) {

            if (!Array.isArray(this.val)) {
                this.val = [];
            }

            this.fieldItem = {
                field,
                value: JSON.parse(JSON.stringify(field.default || null)),
                create: true
            };
        },

        editFieldItem(field, index) {

            this.fieldItem = {
                field,
                value: JSON.parse(JSON.stringify(this.val[index])),
                index
            };
        },

        saveFieldItem() {

            if (this.fieldItem.field.required) {

                let field = this.fieldItem.field,
                    pass = true,
                    val = this.fieldItem.value;

                if (val && Array.isArray(val) && !val.length) {
                    pass = false;
                }

                if (!val && !(val===false || val===0)) {
                    pass = false;
                }

                if (!pass) {
                    return App.ui.notify(`<span class="kiss-size-xsmall">${this.t('Field required:')}</span><br><strong class="kiss-text-capitalize">${field.label || field.name}</strong>`, 'error');
                }
            }

            if (this.fieldItem.value === null) {
                this.fieldItem = null;
                return;
            }

            if (this.fieldItem.create) {
                this.val.push(this.fieldItem.value);
            } else {
                this.val[this.fieldItem.index] = this.fieldItem.value;
            }

            this.fieldItem = null;
        },

        removeFieldItem(list, index) {
            list.splice(index, 1);
        },

        update() {
            this.$emit('update:modelValue', this.val)
        }
    },

    template: /*html*/`
        <div v-if="fieldTypes">

            <component :is="getFieldType()" v-model="val" v-bind="field.opts" v-if="!field.multiple"></component>

            <div v-if="field.multiple">
                <kiss-card class="kiss-padding-small kiss-size-small kiss-color-muted" theme="bordered contrast" v-show="!val || !Array.isArray(val) || !val.length">{{ t('No items') }}</kiss-card>

                <vue-draggable v-model="val" handle=".fm-handle" v-if="Array.isArray(val)">
                    <template #item="{ element, index }">
                        <div class="kiss-margin-small kiss-flex kiss-flex-middle">
                            <kiss-card class="kiss-flex-1 kiss-padding-small kiss-size-small kiss-position-relative" theme="bordered contrast">
                                <span class="kiss-badge kiss-badge-outline kiss-color-muted" v-if="val[index] == null">n/a</span>
                                <div class="kiss-text-truncate" v-else-if="fieldTypes[field.type] && fieldTypes[field.type].render" v-html="fieldTypes[field.type].render(val[index], field)"></div>
                                <div v-else>
                                    <span class="kiss-badge kiss-badge-outline" v-if="Array.isArray(val[index])">{{ val[index].length }}</span>
                                    <span class="kiss-badge kiss-badge-outline" v-else-if="typeof(val[index]) == 'object'">Object</span>
                                    <div class="kiss-text-truncate" v-else>{{ val[index] }}</div>
                                </div>
                                <a class="kiss-cover" @click="editFieldItem(field, index)"></a>
                            </kiss-card>
                            <a class="kiss-margin-small-left kiss-color-danger" @click="removeFieldItem(val, index)"><icon>delete</icon></a>
                            <a class="fm-handle kiss-margin-left kiss-color-muted"><icon>drag_handle</icon></a>
                        </div>
                    </template>
                </vue-draggable>

                <div class="kiss-margin kiss-align-center">
                    <a @click="addFieldItem(field)" :tooltip="t('Add item')" flow="down"><icon class="kiss-size-large">control_point</icon></a>
                </div>
            </div>
        </div>

        <teleport to="body">
            <kiss-dialog open="true" size="large" v-if="fieldItem">
                <kiss-content class="animated fadeInUp faster">

                    <div class="kiss-size-4 kiss-text-bold kiss-margin">{{fieldItem.create ? t('Add item'):t('Edit item')}}</div>

                    <div class="kiss-margin-top">
                        <div class="kiss-margin-bottom"><span class="kiss-badge kiss-text-upper">{{fieldItem.field.type}}</span></div>
                        <component :is="getFieldType()" v-model="fieldItem.value" v-bind="field.opts"></component>
                    </div>

                    <div class="kiss-button-group kiss-child-width-1-2 kiss-flex kiss-margin-top">
                        <a class="kiss-button" @click="fieldItem=null">
                            {{ t('Cancel') }}
                        </a>
                        <button class="kiss-button kiss-button-primary" @click="saveFieldItem">
                            <span v-if="!fieldItem.create">{{ t('Edit item') }}</span>
                            <span v-if="fieldItem.create">{{ t('Add item') }}</span>
                        </button>
                    </div>

                </kiss-content>
            </kiss-dialog>
        </teleport>
    `
}


export default {

    data() {

        return {
            val: this.modelValue,
            group: null
        }
    },

    props: {
        modelValue: {
            default: null
        },
        fields: {
            type: Array,
            default: []
        },
        locales: {
            type: Array,
            default: []
        },
        nested: {
            default: false
        },
    },

    mounted() {

        App.on('fields-renderer-validate', evt => {

            if (!evt.params.root.contains(this.$el)) {
                return;
            }

            let errors = [], pass = true, val;

            this.fields.forEach(field => {

                val = this.val[field.name];
                pass = true;

                if (field.required) {

                    if (val && Array.isArray(val) && !val.length) {
                        pass = false;
                    }

                    if (!val && !(val===false || val===0)) {
                        pass = false;
                    }
                }

                if (!pass) {
                    errors.push({field, required: true});
                    App.ui.notify(`<span class="kiss-size-xsmall">${this.t('Field required:')}</span><br><strong class="kiss-text-capitalize">${field.label || field.name}</strong>`, 'error');
                }
            });

            if (errors.length) {
                evt.params.errors = errors;
            }
        });
    },

    watch: {
        val: {
            handler() { this.update() },
            deep: true
        },
        modelValue() {
            this.val = this.modelValue;
            this.update();
        }
    },

    computed: {
        groups() {

            let groups = [];

            (this.fields || []).forEach(field => {
                if (!field.group || groups.indexOf(field.group) > -1) return;
                if (!this.checkFieldCondition(field)) return;
                groups.push(field.group);
            });

            return groups.sort();
        },

        visibleFields() {

            return (this.fields || []).filter(field => {

                if (!this.checkFieldCondition(field)) {
                    return false;
                }

                return !this.group || this.group == field.group;
            });
        },
        visibleLocales() {
            return this.locales.filter(l => l.visible);
        }
    },

    components: {
        fieldRenderer: FieldRenderer
    },

    methods: {

        clear(field, val) {

            val[field.name] = (field.opts && field.opts.default !== undefined && field.opts.default) || null;

            if (field.i18n && this.locales.length) {

                this.locales.forEach(l => {
                    val[`${field.name}_${l.i18n}`] = ((field.opts && field.opts[`default_${l.i18n}`]) || null)
                });
            }
        },

        copyLocaleValue(to, from, field) {
            to = field+(to == 'default' ? '': '_'+to);
            from = field+(from == 'default' ? '': '_'+from);

            this.val[to] = JSON.parse(JSON.stringify(this.val[from]));
        },

        update() {
            this.$emit('update:modelValue', this.val)
        },

        checkFieldCondition(field) {

            if (!field.condition) {
                return true;
            }

            // compile condition
            if (typeof(field.condition) === 'string') {
                field.condition = new Function('data', `return ${field.condition}`);
            }

            try {
                return field.condition(this.val);
            } catch(e) {}

            return true;
        }
    },

    template: /*html*/`
        <div class="fields-renderer" :nested="nested">

            <kiss-tabs class="kiss-margin-large-bottom" static="true" v-if="groups.length">
                <ul class="kiss-tabs-nav">
                    <li :active="group === null">
                        <a class="kiss-tabs-nav-link" @click="group = null">{{t('All')}}</a>
                    </li>
                    <li :active="group == name" v-for="name in groups">
                        <a class="kiss-tabs-nav-link" @click="group = name">{{ name }}</a>
                    </li>
                </ul>
            </kiss-tabs>

            <app-fieldcontainer class="kiss-margin" v-for="field in visibleFields">
                <div>
                    <div class="kiss-flex kiss-flex-middle">
                        <label class="fields-renderer-field kiss-text-capitalize kiss-flex kiss-flex-middle kiss-flex-1">
                            <div>{{field.label || field.name}}</div>
                            <icon class="kiss-size-5 kiss-color-muted kiss-margin-xsmall-left" v-if="field.i18n && locales.length" :title="t('Localized')">language</icon>
                            <icon class="kiss-size-5 kiss-color-danger kiss-margin-xsmall-left" v-if="field.required" :title="t('Required')">trip_origin</icon>
                        </label>
                        <a class="app-fieldcontainer-visible-hover kiss-size-xsmall kiss-margin-left" @click="clear(field, val)" v-if="!nested">{{ t('Clear') }}</a>
                    </div>
                </div>
                <div class="kiss-color-muted kiss-size-xsmall" v-if="field.info">{{ field.info }}</div>

                <div class="kiss-margin-small-top" v-if="!field.i18n || !locales.length">
                    <field-renderer :field="field" v-model="val[field.name]"></field-renderer>
                </div>

                <div class="kiss-margin-small-top" v-if="field.i18n && locales.length">
                    <div class="kiss-margin" v-for="locale in visibleLocales">
                        <div class="kiss-margin-small kiss-flex kiss-flex-middle kiss-visible-toggle">
                            <span class="kiss-badge kiss-badge-outline kiss-color-primary">{{ locale.i18n }}</span>
                            <kiss-dropdown class="kiss-margin-xsmall-left">
                                <a class="kiss-invisible-hover kiss-color-muted" :ariaLabel="t('Copy value from another locale')" kiss-tooltip="right"><icon>copy</icon></a>

                                <kiss-dropdownbox pos="left">
                                    <kiss-navlist>
                                        <ul>
                                            <li class="kiss-nav-header">{{ t('Locale') }}</li>
                                            <li :class="{'kiss-hidden': l.i18n == locale.i18n}" v-for="l in locales"><a @click="copyLocaleValue(locale.i18n, l.i18n, field.name)">{{ l.name }}</a></li>
                                        </ul>
                                    </kiss-navlist>
                                </kiss-dropdownbox>
                            </kiss-dropdown>
                        </div>
                        <field-renderer :field="field" :locale="locale.i18n" v-model="val[field.name+(locale.i18n == 'default' ? '': '_'+locale.i18n)]"></field-renderer>
                    </div>
                </div>

            </app-fieldcontainer>
        </div>
    `
}