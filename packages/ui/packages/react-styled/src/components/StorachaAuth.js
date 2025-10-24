"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useStorachaAuth = exports.StorachaAuth = exports.StorachaAuthEnsurer = exports.StorachaAuthSubmitted = exports.StorachaAuthCancelButton = exports.StorachaAuthEmailInput = exports.StorachaAuthForm = exports.StorachaAuthProvider = void 0;
var react_1 = require("react");
var ui_react_1 = require("@storacha/ui-react");
var StorachaAuthProvider = function (props) {
    return <ui_react_1.StorachaAuth {...props}/>;
};
exports.StorachaAuthProvider = StorachaAuthProvider;
/**
 * Styled form component with console-exact design
 */
var StorachaAuthForm = function () {
    return (<ui_react_1.StorachaAuth.Form renderContainer={function (children) { return (<div className='authenticator'>
          {children}
          <p className='storacha-auth-terms'>
            By registering with storacha.network, you agree to the storacha.network{' '}
            <a href='https://docs.storacha.network/terms/'>Terms of Service</a>.
          </p>
        </div>); }} renderLogo={function () { return (<div className='storacha-auth-logo-container'>
          <img src="/storacha-logo.svg" alt="Storacha" className='storacha-auth-logo'/>
        </div>); }} renderEmailLabel={function () { return (<label className='storacha-auth-label' htmlFor='storacha-auth-email'>
          Email
        </label>); }} renderSubmitButton={function (disabled) { return (<div className='storacha-auth-button-container'>
          <button className='storacha-auth-button' type='submit' disabled={disabled}>
            Authorize
          </button>
        </div>); }} className='storacha-auth-form'/>);
};
exports.StorachaAuthForm = StorachaAuthForm;
/**
 * Styled email input with console-exact design
 */
var StorachaAuthEmailInput = function () {
    return (<ui_react_1.StorachaAuth.EmailInput className='storacha-auth-input' id='storacha-auth-email'/>);
};
exports.StorachaAuthEmailInput = StorachaAuthEmailInput;
/**
 * Styled cancel button with console-exact design
 */
var StorachaAuthCancelButton = function () {
    return (<ui_react_1.StorachaAuth.CancelButton className='storacha-auth-button'>
      Cancel
    </ui_react_1.StorachaAuth.CancelButton>);
};
exports.StorachaAuthCancelButton = StorachaAuthCancelButton;
/**
 * Styled submitted state with console-exact design
 */
var StorachaAuthSubmitted = function () {
    var email = (0, ui_react_1.useStorachaAuth)()[0].email;
    return (<ui_react_1.StorachaAuth.Submitted renderContainer={function (children) { return (<div className='authenticator'>
          {children}
        </div>); }} renderLogo={function () { return (<div className='storacha-auth-logo-container'>
          <img src="/storacha-logo.svg" alt="Storacha" className='storacha-auth-logo'/>
        </div>); }} renderTitle={function () { return (<h1 className='storacha-auth-submitted-title'>Verify your email address!</h1>); }} renderMessage={function (email) { return (<p className='storacha-auth-submitted-text'>
          Click the link in the email we sent to{' '}
          <span className='storacha-auth-submitted-email'>{email}</span> to authorize this agent.
          <br />
          Don&apos;t forget to check your spam folder!
        </p>); }} renderCancelButton={function () { return <exports.StorachaAuthCancelButton />; }} className='storacha-auth-submitted-container'/>);
};
exports.StorachaAuthSubmitted = StorachaAuthSubmitted;
/**
 * Styled ensurer with console-exact loading states
 */
var StorachaAuthEnsurer = function (_a) {
    var children = _a.children;
    return (<ui_react_1.StorachaAuth.Ensurer renderLoader={function (type) { return (<div className="storacha-auth-loader">
          <div className="storacha-auth-spinner"/>
          <h3 className="storacha-auth-loader-title">
            {type === 'initializing' ? 'Initializing' : 'Authentication'}
          </h3>
          <p className="storacha-auth-loader-text">
            {type === 'initializing' ? 'Setting up authentication...' : 'Loading...'}
          </p>
        </div>); }} renderForm={function () { return <exports.StorachaAuthForm />; }} renderSubmitted={function () { return <exports.StorachaAuthSubmitted />; }}>
      {children}
    </ui_react_1.StorachaAuth.Ensurer>);
};
exports.StorachaAuthEnsurer = StorachaAuthEnsurer;
/**
 * Complete styled StorachaAuth component suite with console-exact UI
 */
exports.StorachaAuth = Object.assign(exports.StorachaAuthProvider, {
    Form: exports.StorachaAuthForm,
    EmailInput: exports.StorachaAuthEmailInput,
    CancelButton: exports.StorachaAuthCancelButton,
    Submitted: exports.StorachaAuthSubmitted,
    Ensurer: exports.StorachaAuthEnsurer,
});
// Re-export the hook
var ui_react_2 = require("@storacha/ui-react");
Object.defineProperty(exports, "useStorachaAuth", { enumerable: true, get: function () { return ui_react_2.useStorachaAuth; } });
