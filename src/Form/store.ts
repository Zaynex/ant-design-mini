import Schema from 'async-validator';
import EventEmitter from '../_util/eventEmitter'
export class FormStore extends EventEmitter {
  private formData: Record<string, any>;
  private errorInfo: Record<string, any>;
  private rules: Record<string, any>;
  private fields: string[];

  constructor() {
    super();
    this.fields = [];
    this.formData = {};
    this.errorInfo = {};
    this.rules = {};
  }

  onValuesChange(cb) {
    this.addListener('valuesChange', cb);
  }

  offValuesChange(cb) {
    this.removeListener('valuesChange', cb);
  }

  emitValuesChange(changedValue, allValue, options) {
    this.emit('valuesChange', changedValue, allValue, options);
  }

  addField(fieldName) {
    this.fields.push(fieldName);
  }

  removeField(fieldName) {
    this.fields.splice(this.fields.indexOf(fieldName), 1);
    delete this.formData[fieldName];
    delete this.rules[fieldName];
    delete this.errorInfo[fieldName];
  }

  setFieldsValueByFormItemInitial(values =  {}, options) {
    Object.keys(values).forEach(fieldName => {
      if (values[fieldName] !== undefined) {
        this.formData[fieldName] = values[fieldName];
        this.emitValuesChange({ [fieldName]: values[fieldName] }, this.formData, options);
      } else {
        this.emitValuesChange({ [fieldName]: values[fieldName] }, this.formData, { ...options, syncFormItem: true  });
      }
    });
  }

  setFieldsValue(values = {}, options = {}) {
    Object.keys(values).forEach((key) => {
      if (this.checkFieldInited(key)) {
        this.formData[key] = values[key];
      }
    });
    this.emitValuesChange(values, this.formData, options);
  }

  checkFieldInited(fieldName) {
    return this.fields.indexOf(fieldName) > -1;
  }

  getFieldsValue() {
    return this.formData;
  }

  getFieldValue(fieldName) {
    return this.formData[fieldName];
  }

  setFieldRules(fieldName, rule) {
    this.rules[fieldName] = rule;
  }

  getValidator() {
    const { rules } = this;
    return new Schema(rules);
  }

  onErrorInfoChange(cb) {
    this.addListener('errorInfoChange', cb);
  }

  offErrorInfoChange(cb) {
    this.removeListener('errorInfoChange', cb);
  }

  emitErrorInfoChange(errorInfo, fieldName) {
    this.emit('errorInfoChange', errorInfo, fieldName);
  }

  setErrorInfo(errorInfo, options) {
    const fieldName = options?.fieldName;
    // 如果指定了fieldName，只更新该field下的errorInfo
    if (fieldName) {
      this.errorInfo[fieldName] = errorInfo[fieldName];
    } else {
      this.errorInfo = errorInfo;
    }
    this.emitErrorInfoChange(errorInfo, options);
  }

  validate(options?: Record<string, any>): Promise<{ valid: boolean, errors?: Record<string, any>}> {
    return new Promise(resovle => {
      const allValues = this.getFieldsValue();
      this.getValidator()
        .validate(allValues)
        .then(() => {
          this.setErrorInfo({}, options);
          resovle({
            valid: true,
          });
        })
        .catch(({ fields: errorInfo }) => {
          this.setErrorInfo(errorInfo, options);
          resovle({
            valid: false,
            errors: errorInfo,
          });
        });
    });
  }

  onSubmit(cb) {
    this.addListener('submit', cb);
  }

  offSubmit(cb) {
    this.removeListener('submit', cb);
  }

  emitSubmit() {
    this.emit('submit');
  }
}

type params = {
  uid?: string;
  pageId: string;
  componentId?: string;
  fieldName?:  string;
};

const formStoreFactory = (() => {
  const instances = {};

  const getFormKey = function({ pageId, componentId, uid }: params) {
    let key = `${pageId}-${componentId}`
    if (uid) {
      key = `${pageId}-multiform-${uid}`
    }
    return key;
  }

  const  checkDuplicate  = function(key) {
    const uids = Object.keys(instances);
    if (uids.length === 0) return false
    return uids.some(formKey => formKey === key)
  }

  return {
    createStore({ pageId, componentId, uid }: params) {
      const key = getFormKey({ pageId, componentId, uid });
      const count = this.getCurrentPaggeInstanceCount({pageId});
      if (count > 0) {
        if (!uid) 
        throw new Error('more than one forms exist in current page, props form is required in Form and FormItem')
      }
      const isDuplicatedFormKey = checkDuplicate(key)
      if (isDuplicatedFormKey) {
        throw new Error(`${uid} already exited, make sure prop form be unique in current page`);
      }
      instances[key] = new FormStore();
      return instances[key];
    },

    getStore({ pageId, componentId, uid, fieldName }: params) {
      const key = getFormKey({ pageId, componentId, uid })
      const count = this.getCurrentPaggeInstanceCount({ pageId });
      if (count > 1 && !uid) {
        throw new Error('more than one forms exist in current page, props form is required in FormItem')
      }
      let instance = instances[key];
      // 当前页面只有1个且存在动态FormItem时，取当前页面的store
      if (!instance && count === 1 && !componentId) {
        const uids = Object.keys(instances).filter(key  =>  key.indexOf(`${pageId}-`) === 0);
        instance =instances[uids[0]]
      }
      if (!instance) {
        throw Error(`uid ${uid} was not found in current page, make sure prop form in ${fieldName} FormItem be consistent with its in Parent Form `);
      }
      return instance;
    },

    getCurrentPaggeInstanceCount({ pageId  }) {
      const uids = Object.keys(instances).filter(key  =>  key.indexOf(`${pageId}-`) === 0);
      return uids.length
    },

    destroyStore({ pageId, componentId, uid }: params) {
      const key = getFormKey({ pageId, componentId, uid })
      delete instances[key];
    },
  };
})();

export default formStoreFactory;
