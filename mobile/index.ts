import { registerRootComponent } from 'expo';
import App from './App';
// Dev-only validation harness; never selected by a release bundle.
registerRootComponent(__DEV__&&process.env.EXPO_PUBLIC_PREVISUAL_VALIDATION==='1'?require('./src/validation/PrevisualNative').default:App);
