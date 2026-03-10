const PAY_SALARY = value => {
  if (value?.description && value?.description.length > 50) {
    return {
      result: false,
      errMsg: '薪资补充说明不能超过50个字符'
    };
  }
  if (!value?.minimumAmount) {
    return {
      result: false,
      errMsg: '请填写最低薪资'
    };
  }
  if (!value?.maximumAmount) {
    return {
      result: false,
      errMsg: '请填写最高薪资'
    };
  }
  if (value?.minimumAmount > value?.maximumAmount) {
    return {
      result: false,
      errMsg: '最低薪资不能大于最高薪资'
    };
  }

  return {
    result: true,
    errMsg: ''
  };
};

export default PAY_SALARY;
