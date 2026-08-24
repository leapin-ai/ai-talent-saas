import getApis from './getApis';
import { FILE_DIRECTORY } from './fileDirectories';

const Apis = ({ children }) => {
  return children({ getApis });
};

export default Apis;

export { getApis, FILE_DIRECTORY };
