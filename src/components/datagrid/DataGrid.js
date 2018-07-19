import _ from 'lodash';
import NestedComponent from '../_classes/nested/NestedComponent';

export default class DataGridComponent extends NestedComponent {
  static schema(...extend) {
    return NestedComponent.schema({
      label: 'Data Grid',
      key: 'dataGrid',
      type: 'datagrid',
      clearOnHide: true,
      input: true,
      tree: true,
      components: []
    }, ...extend);
  }

  static get builderInfo() {
    return {
      title: 'Data Grid',
      icon: 'th',
      group: 'data',
      documentation: 'http://help.form.io/userguide/#datagrid',
      weight: 20,
      schema: DataGridComponent.schema()
    };
  }

  constructor(...args) {
    super(...args);
    this.type = 'datagrid';
  }

  init() {
    this.components = this.components || [];
    this.numColumns = 0;

    // Add new values based on minLength.
    for (let dIndex = this.dataValue.length; dIndex < _.get(this.component, 'validate.minLength', 0); dIndex++) {
      this.dataValue.push({});
    }

    this.rows = [];
    this.createRows();

    this.visibleColumns = {};
    this.checkColumns(this.dataValue);
  }

  get dataValue() {
    const dataValue = super.dataValue;
    if (!dataValue || !_.isArray(dataValue)) {
      return this.emptyValue;
    }
    return dataValue;
  }

  set dataValue(value) {
    super.dataValue = value;
  }

  get defaultSchema() {
    return DataGridComponent.schema();
  }

  get emptyValue() {
    return [{}];
  }

  get addAnotherPosition() {
    return _.get(this.component, 'addAnotherPosition', 'bottom');
  }

  get defaultValue() {
    const value = super.defaultValue;
    if (_.isArray(value)) {
      return value;
    }
    if (value && (typeof value === 'object')) {
      return [value];
    }
    return this.emptyValue;
  }

  get datagridKey() {
    return `datagrid-${this.key}`;
  }

  hasAddButton() {
    const maxLength = _.get(this.component, 'validate.maxLength');
    return !this.component.disableAddingRemovingRows &&
      !this.shouldDisable &&
      this.options.attachMode === 'full' &&
      !this.options.preview &&
      (!maxLength || (this.dataValue.length < maxLength));
  }

  hasExtraColumn() {
    return this.hasRemoveButtons() || this.options.attachMode === 'builder';
  }

  hasRemoveButtons() {
    return !this.component.disableAddingRemovingRows &&
      !this.shouldDisable &&
      this.options.attachMode === 'full' &&
      (this.dataValue.length > _.get(this.component, 'validate.minLength', 0));
  }

  hasTopSubmit() {
    return this.hasAddButton() && ['top', 'both'].includes(this.addAnotherPosition);
  }

  hasBottomSubmit() {
    return this.hasAddButton() && ['bottom', 'both'].includes(this.addAnotherPosition);
  }

  hasChanged(before, after) {
    return !_.isEqual(before, after);
  }

  render() {
    return super.render(this.renderTemplate('datagrid', {
      rows: this.rows.map(row => {
        const components = {};
        _.each(row, (col, key) => {
          components[key] = col.render();
        });
        return components;
      }),
      visibleColumns: this.visibleColumns,
      hasHeader: this.component.components.reduce((hasHeader, col) => {
        // If any of the components has a title and it isn't hidden, display the header.
        return hasHeader || ((col.label || col.title) && !col.hideLabel);
      }, false),
      hasExtraColumn: this.hasExtraColumn(),
      hasAddButton: this.hasAddButton(),
      hasRemoveButtons: this.hasRemoveButtons,
      hasTopSubmit: this.hasTopSubmit(),
      hasBottomSubmit: this.hasBottomSubmit(),
      numColumns: _.filter(this.visibleColumns).length + (this.hasExtraColumn() ? 1 : 0),
      datagridKey: this.datagridKey,
      builder: this.options.attachMode === 'builder',
      placeholder: this.renderTemplate('builderPlaceholder', {
        position: this.component.components.length,
      }),
    }));
  }

  attach(element) {
    this.loadRefs(element, {
      [`${this.datagridKey}-addRow`]: 'multiple',
      [`${this.datagridKey}-removeRow`]: 'multiple',
      [this.datagridKey]: 'multiple',
    });

    this.refs[`${this.datagridKey}-addRow`].forEach((addButton) => {
      this.addEventListener(addButton, 'click', this.addRow.bind(this));
    });

    this.refs[`${this.datagridKey}-removeRow`].forEach((removeButton, index) => {
      this.addEventListener(removeButton, 'click', this.removeRow.bind(this, index));
    });

    const rowLength = _.filter(this.visibleColumns).length;
    this.rows.forEach((row, rowIndex) => {
      let columnIndex = 0;
      this.component.components.forEach((col) => {
        if (this.visibleColumns[col.key]) {
          this.attachComponents(
            this.refs[this.datagridKey][(rowIndex * rowLength) + columnIndex],
            [this.rows[rowIndex][col.key]],
            this.component.components
          );
          columnIndex++;
        }
      });
    });
    super.attach(element);
  }

  addRow() {
    this.dataValue.push({});
    const index = this.rows.length;
    this.rows[index] = this.createRowComponents(this.dataValue[index], index);
    this.redraw();
  }

  removeRow(index) {
    this.splice(index);
    this.rows.splice(index, 1);
    this.redraw();
  }

  createRows() {
    // Create any missing rows.
    this.dataValue.forEach((row, index) => {
      if (!this.rows[index]) {
        this.rows[index] = this.createRowComponents(row, index);
      }
    });
    // Delete any extra rows.
    this.rows.splice(this.dataValue.length);
  }

  createRowComponents(row, rowIndex) {
    const components = {};
    this.component.components.map((col, colIndex) => {
      const options = _.clone(this.options);
      options.name += `[${rowIndex}]`;
      options.row = `${rowIndex}-${colIndex}`;
      components[col.key] = this.createComponent(col, options, row);
      components[col.key].rowIndex = rowIndex;
      components[col.key].inDataGrid = true;
    });
    return components;
  }

  checkColumns(data) {
    let show = false;

    if (!this.rows || !this.rows.length) {
      return;
    }

    const visibility = {};

    this.rows.forEach((row) => {
      _.each(row, (col, key) => {
        if (col && (typeof col.checkConditions === 'function')) {
          visibility[key] = !!visibility[key] || col.checkConditions(data);
        }
      });
    });
    const rebuild = !_.isEqual(visibility, this.visibleColumns);
    _.each(visibility, (col) => {
      show |= col;
    });

    this.visibleColumns = visibility;
    return { rebuild, show };
  }

  checkConditions(data) {
    // If table isn't visible, don't bother calculating columns.
    if (!super.checkConditions(data)) {
      return false;
    }

    const { rebuild, show } = this.checkColumns(data);
    // If a rebuild is needed, then rebuild the table.
    if (rebuild) {
      this.redraw();
    }

    // Return if this table should show.
    return show;
  }

  setValue(value, flags) {
    flags = this.getFlags.apply(this, arguments);
    if (!value) {
      this.createRows();
      return;
    }
    if (!Array.isArray(value)) {
      if (typeof value === 'object') {
        value = [value];
      }
      else {
        this.createRows();
        value = [{}];
      }
    }

    const changed = this.hasChanged(value, this.dataValue);
    this.dataValue = value;
    this.createRows();
    this.rows.forEach((row, rowIndex) => {
      if (value.length <= rowIndex) {
        return;
      }
      _.each(row, (col, key) => {
        if (col.type === 'components') {
          col.setValue(value[rowIndex], flags);
        }
        else if (value[rowIndex].hasOwnProperty(key)) {
          col.data = value[rowIndex];
          col.setValue(value[rowIndex][key], flags);
        }
        else {
          col.data = value[rowIndex];
          col.setValue(col.defaultValue, flags);
        }
      });
    });
    if (changed) {
      this.redraw();
    }
    return changed;
  }

  /**
   * Get the value of this component.
   *
   * @returns {*}
   */
  getValue() {
    if (this.viewOnly) {
      return this.dataValue;
    }
    const values = [];
    _.each(this.rows, (row) => {
      const value = {};
      _.each(row, (col, key) => {
        _.set(value, key, col.getValue());
      });
      values.push(value);
    });
    return values;
  }
}
