const accountingDb = {
  async query(sql, params = [], method = 'all') {
    if (window.electronAPI?.accountingQuery) {
      return window.electronAPI.accountingQuery({ sql, params, method });
    }

    console.log('Accounting DB Query (browser mode):', sql, params);
    return method === 'get' ? null : [];
  },

  async run(sql, params = []) {
    return this.query(sql, params, 'run');
  },

  async get(sql, params = []) {
    return this.query(sql, params, 'get');
  },

  async all(sql, params = []) {
    return this.query(sql, params, 'all');
  }
};

export default accountingDb;
