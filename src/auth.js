import './auth.css';

const frenchAccountCopy = {
  'Accounts are not configured yet. You can still compress PDFs for free without an account.': 'Les comptes ne sont pas encore disponibles. Vous pouvez toujours compresser vos PDF gratuitement sans compte.',
  'Too many attempts. Please wait a minute and try again.': 'Trop de tentatives. Patientez une minute avant de réessayer.',
  'Account service is unavailable. You can still compress PDFs without an account.': 'Le service de compte est indisponible. Vous pouvez toujours compresser vos PDF sans compte.',
  'Unable to complete this account request. Please check your details and try again.': 'Impossible de terminer cette demande. Vérifiez les informations saisies et réessayez.',
  'My account': 'Mon compte', 'Sign in': 'Se connecter', 'Welcome back': 'Heureux de vous revoir',
  'Create an account': 'Créer un compte', 'Reset your password': 'Réinitialiser votre mot de passe',
  'Choose a new password': 'Choisir un nouveau mot de passe', 'Your account': 'Votre compte',
  'Close account dialog': 'Fermer la fenêtre de compte',
  'Account settings are separate from your files.': 'Les paramètres de votre compte sont distincts de vos fichiers.',
  'An account is optional. PDF compression always happens on your device.': 'Le compte est facultatif. La compression des PDF se fait toujours sur votre appareil.',
  'Sign out': 'Se déconnecter', 'Continue with Google': 'Continuer avec Google',
  'Google sign-in is not configured yet.': 'La connexion Google n’est pas encore disponible.',
  'or use email': 'ou par e-mail', 'Name': 'Nom', 'Email address': 'Adresse e-mail', 'Password': 'Mot de passe',
  'Use at least 8 characters.': 'Utilisez au moins 8 caractères.', 'Create account': 'Créer un compte',
  'Confirm password': 'Confirmer le mot de passe',
  'Passwords do not match.': 'Les mots de passe ne correspondent pas.',
  'Delete account': 'Supprimer le compte',
  'Before deleting your account': 'Avant de supprimer votre compte',
  'Deleting your account permanently removes your profile, linked sign-ins and all active sessions. This does not delete your Google account or files on your device.': 'La suppression efface définitivement votre profil, vos connexions associées et toutes vos sessions actives. Elle ne supprime ni votre compte Google ni les fichiers de votre appareil.',
  'We will email a confirmation link valid for one hour. Open it in this browser while still signed in. Nothing is deleted until you confirm.': 'Nous vous enverrons un lien de confirmation valable une heure. Ouvrez-le dans ce navigateur en restant connecté. Rien ne sera supprimé avant votre confirmation.',
  'Type DELETE to continue': 'Saisissez SUPPRIMER pour continuer',
  'Enter DELETE exactly to request the confirmation email.': 'Saisissez exactement SUPPRIMER pour demander l’e-mail de confirmation.',
  'Send deletion confirmation': 'Envoyer la confirmation de suppression',
  'Cancel and return to account': 'Annuler et revenir au compte',
  'Check your inbox. Open the deletion link in this browser while still signed in. You can ignore the email to keep your account.': 'Consultez votre messagerie. Ouvrez le lien de suppression dans ce navigateur en restant connecté. Ignorez cet e-mail si vous souhaitez conserver votre compte.',
  'Your account has been deleted. You can still compress PDFs without an account.': 'Votre compte a été supprimé. Vous pouvez toujours compresser vos PDF sans compte.',
  'For account or privacy help, contact': 'Pour toute question sur votre compte ou vos données, contactez',
  'Account deletion is temporarily unavailable. Contact us for help.': 'La suppression du compte est temporairement indisponible. Contactez-nous pour obtenir de l’aide.',
  'Send reset link': 'Envoyer le lien', 'Update password': 'Modifier le mot de passe',
  'Forgot password?': 'Mot de passe oublié ?', 'Back to sign in': 'Retour à la connexion',
  'Only account details go to our account service. Your PDFs stay in your browser.': 'Seules les informations de compte sont envoyées à notre service. Vos PDF restent dans votre navigateur.',
  'Privacy policy': 'Confidentialité',
  'Google sign-in did not return an authorization URL.': 'La connexion Google est indisponible. Veuillez réessayer.',
  'Unexpected Google authorization destination.': 'La connexion Google est indisponible. Veuillez réessayer.',
  'You have signed out.': 'Vous êtes déconnecté.',
  'Unable to sign in. Check your email and password, and verify your email before signing in.': 'Connexion impossible. Vérifiez votre adresse e-mail et votre mot de passe, et confirmez votre adresse avant de vous connecter.',
  'If this address can be registered, a verification email will arrive shortly. Check your inbox before signing in.': 'Si cette adresse peut être inscrite, vous recevrez bientôt un e-mail de confirmation. Consultez votre messagerie avant de vous connecter.',
  'If an eligible account exists, a password reset email will arrive shortly.': 'Si un compte admissible existe, vous recevrez bientôt un e-mail de réinitialisation.',
  'This reset link is incomplete. Request a new link.': 'Ce lien est incomplet. Demandez un nouveau lien.',
  'Password updated. Please sign in.': 'Mot de passe modifié. Vous pouvez vous connecter.',
  'Email delivery is not configured yet. Please use Google sign-in if available.': 'L’envoi d’e-mails n’est pas encore disponible. Utilisez la connexion Google si elle est proposée.',
  'Please wait…': 'Veuillez patienter…', 'Connecting to account service…': 'Connexion au service de compte…',
  'Your reset link is invalid or expired. Request a new link.': 'Ce lien est invalide ou a expiré. Demandez un nouveau lien.',
  'Email verified. You can now sign in.': 'Adresse e-mail confirmée. Vous pouvez vous connecter.',
  'Sign-in could not be completed. Please try again.': 'La connexion n’a pas abouti. Veuillez réessayer.',
  'Sign in to download your PDF. Your file and compression results stay here.': 'Connectez-vous pour télécharger votre PDF. Votre fichier et le résultat de compression restent ici.',
  'You can compress without an account. Sign in to download your PDF.': 'Vous pouvez compresser sans compte. Connectez-vous pour télécharger votre PDF.',
  'We could not preserve your PDF for the sign-in redirect. Your result is still here. Use email sign-in or allow browser storage and try again.': 'Impossible de conserver votre PDF pendant la redirection. Votre résultat reste ici. Connectez-vous par e-mail ou autorisez le stockage du navigateur et réessayez.',
};

export function translateAuthText(text, locale = 'fr') {
  if (locale !== 'fr') return text;
  const trimmed = text.trim();
  return frenchAccountCopy[trimmed] ? text.replace(trimmed, frenchAccountCopy[trimmed]) : text;
}

export function initAuth({ onUserChange = () => {}, beforeRedirect = async () => `${location.origin}${location.pathname}` } = {}) {
  const locale = document.documentElement.lang === 'en' ? 'en' : 'fr';
  const t = text => translateAuthText(text, locale);
  const dialog = document.createElement('dialog');
  dialog.className = 'account-dialog';
  dialog.setAttribute('aria-labelledby', 'account-title');
  document.body.append(dialog);
  let view = 'login', config = null, user = null, busy = false, configurationError = '', deletionEmailSent = false;
  let downloadIntent = false;
  const unavailableMessage = 'Accounts are not configured yet. You can still compress PDFs for free without an account.';
  const submissionDisabled = () => !config?.configured || (view === 'register' && !config.emailRegistration) || (view === 'forgot' && !config.passwordReset) || (view === 'delete' && (!config.accountDeletion || deletionEmailSent));
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const query = new URLSearchParams(location.search);
  const resetToken = query.get('token');
  const isReset = query.get('account') === 'reset';
  const callbackURL = `${location.origin}${location.pathname}`;
  async function redirectURL(account) {
    const url = new URL(await beforeRedirect(), location.origin);
    if (account) url.searchParams.set('account', account);
    return url.href;
  }
  async function refreshSession() {
    await configurationReady;
    if (!config?.configured) return null;
    const session = await api('get-session');
    user = session?.user || null;
    updateTriggers(); onUserChange(user);
    return user;
  }
  async function api(path, data) {
    const response = await fetch(`/api/auth/${path}`, {
      method: data ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Accept-Language': locale, ...(data ? { 'Content-Type': 'application/json' } : {}) }, body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json().catch(() => null);
    if ((!result && path !== 'get-session') || !response.ok) {
      const error = new Error(response.status === 429 ? 'Too many attempts. Please wait a minute and try again.' : response.status >= 400 && response.status < 500 ? 'Unable to complete this account request. Please check your details and try again.' : 'Account service is unavailable. You can still compress PDFs without an account.');
      error.status = response.status; throw error;
    }
    return result;
  }
  function status(message, error = false) {
    const target = dialog.querySelector('[data-account-status]');
    if (target) { target.textContent = t(message); target.classList.toggle('is-error', error); }
  }
  function updateTriggers() {
    document.querySelectorAll('[data-auth-open]').forEach(button => { button.textContent = t(user ? 'My account' : 'Sign in'); });
  }
  function render() {
    const titles = { login: 'Welcome back', register: 'Create an account', forgot: 'Reset your password', reset: 'Choose a new password', account: 'Your account', delete: 'Before deleting your account' };
    dialog.innerHTML = `<button type="button" class="account-close" aria-label="Close account dialog">×</button>
      <p class="account-eyebrow">COMPRESSER PDF</p><h2 id="account-title">${titles[view]}</h2>
      <p class="account-intro">${view === 'account' ? 'Account settings are separate from your files.' : downloadIntent ? 'Sign in to download your PDF. Your file and compression results stay here.' : 'You can compress without an account. Sign in to download your PDF.'}</p>
      ${view === 'account' ? `<p class="account-identity">${escape(user?.name || '')}<br><span>${escape(user?.email || '')}</span></p><div class="account-actions"><button type="button" class="account-signout" data-account-logout>Sign out</button><button type="button" class="account-delete-link" data-account-view="delete">Delete account</button></div><p class="account-help">For account or privacy help, contact <a href="mailto:report@compresser-pdf.com">report@compresser-pdf.com</a></p>` : view === 'delete' ? `
      <p class="account-help">Deleting your account permanently removes your profile, linked sign-ins and all active sessions. This does not delete your Google account or files on your device.</p>
      <p class="account-help">We will email a confirmation link valid for one hour. Open it in this browser while still signed in. Nothing is deleted until you confirm.</p>
      <form class="account-form"><label>Type DELETE to continue<input name="deleteConfirmation" autocomplete="off" maxlength="20" required></label><button class="account-delete-confirm" type="submit" ${submissionDisabled() ? 'disabled' : ''}>Send deletion confirmation</button></form>
      <div class="account-links"><button type="button" data-account-view="account">Cancel and return to account</button></div>
      <p class="account-help">For account or privacy help, contact <a href="mailto:report@compresser-pdf.com">report@compresser-pdf.com</a></p>` : `
      ${['login', 'register'].includes(view) ? `<button type="button" class="account-google" data-account-google ${config?.google ? '' : 'disabled'}><img class="account-google-icon" src="/google-g.svg" width="20" height="20" alt="" aria-hidden="true"> Continue with Google</button>${config && !config.google ? '<p class="account-help">Google sign-in is not configured yet.</p>' : ''}<div class="account-divider">or use email</div>` : ''}
      <form class="account-form">
        ${view === 'register' ? '<label>Name<input name="name" autocomplete="name" maxlength="100" required></label>' : ''}
        ${view !== 'reset' ? '<label>Email address<input name="email" type="email" autocomplete="email" maxlength="254" required></label>' : ''}
        ${view !== 'forgot' ? `<label>Password<input name="password" type="password" autocomplete="${view === 'login' ? 'current-password' : 'new-password'}" ${view === 'login' ? '' : 'minlength="8"'} maxlength="128" required></label>${view !== 'login' ? '<p class="account-help">Use at least 8 characters.</p>' : ''}` : ''}
        ${view === 'register' ? '<label>Confirm password<input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label>' : ''}
        <button class="account-primary" type="submit" ${submissionDisabled() ? 'disabled' : ''}>${({ login: 'Sign in', register: 'Create account', forgot: 'Send reset link', reset: 'Update password' })[view]}</button>
      </form>
      <div class="account-links">${view === 'login' ? '<button type="button" data-account-view="forgot">Forgot password?</button><button type="button" data-account-view="register">Create an account</button>' : '<button type="button" data-account-view="login">Back to sign in</button>'}</div>`}
      <p data-account-status role="status" aria-live="polite"></p>
      <p class="account-privacy">Only account details go to our account service. Your PDFs stay in your browser. <a href="${locale === 'en' ? '/en/privacy.html' : '/privacy.html'}">Privacy policy</a></p>`;
    // Translate only UI text nodes; keep user-provided identity strings untouched.
    const walker = document.createTreeWalker(dialog, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (!walker.currentNode.parentElement.closest('.account-identity')) walker.currentNode.textContent = t(walker.currentNode.textContent);
    }
    dialog.querySelectorAll('[aria-label]').forEach(element => element.setAttribute('aria-label', t(element.getAttribute('aria-label'))));
    dialog.querySelector('.account-close').onclick = () => dialog.close();
    dialog.querySelectorAll('[data-account-view]').forEach(button => button.onclick = () => { view = button.dataset.accountView; deletionEmailSent = false; render(); });
    dialog.querySelector('[data-account-google]')?.addEventListener('click', () => action(async () => {
      const callback = await redirectURL();
      const errorCallback = new URL(callback); errorCallback.searchParams.set('account', 'error');
      const result = await api('sign-in/social', { provider: 'google', callbackURL: callback, errorCallbackURL: errorCallback.href });
      if (!result.url) throw new Error('Google sign-in did not return an authorization URL.');
      const url = new URL(result.url);
      if (url.protocol !== 'https:' || url.hostname !== 'accounts.google.com') throw new Error('Unexpected Google authorization destination.');
      location.assign(url.href);
    }));
    dialog.querySelector('[data-account-logout]')?.addEventListener('click', () => action(async () => { await api('sign-out', {}); user = null; updateTriggers(); onUserChange(null); view = 'login'; render(); status('You have signed out.'); }));
    dialog.querySelector('form')?.addEventListener('submit', event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      if (view === 'delete' && data.deleteConfirmation !== (locale === 'fr' ? 'SUPPRIMER' : 'DELETE')) {
        status('Enter DELETE exactly to request the confirmation email.', true);
        event.currentTarget.elements.deleteConfirmation.focus();
        return;
      }
      if (view === 'register') {
        if (data.password !== data.confirmPassword) {
          status('Passwords do not match.', true);
          event.currentTarget.elements.confirmPassword.focus();
          return;
        }
        delete data.confirmPassword;
      }
      action(async () => {
        if (view === 'delete') {
          await api('delete-user', { callbackURL: `${callbackURL}?account=deleted` });
          deletionEmailSent = true;
          status('Check your inbox. Open the deletion link in this browser while still signed in. You can ignore the email to keep your account.');
        } else if (view === 'login') {
          try { await api('sign-in/email', data); } catch (error) {
            if (error.status === 429) throw error;
            throw new Error('Unable to sign in. Check your email and password, and verify your email before signing in.');
          }
          if (!await refreshSession()) throw new Error('Unable to sign in. Check your email and password, and verify your email before signing in.');
          if (downloadIntent) { dialog.close(); downloadIntent = false; }
          else { view = 'account'; render(); }
        } else if (view === 'register') {
          await api('sign-up/email', { ...data, locale, callbackURL: await redirectURL('verified') });
          status('If this address can be registered, a verification email will arrive shortly. Check your inbox before signing in.');
        } else if (view === 'forgot') {
          await api('request-password-reset', { email: data.email, locale, redirectTo: await redirectURL('reset') });
          status('If an eligible account exists, a password reset email will arrive shortly.');
        } else {
          if (!resetToken) throw new Error('This reset link is incomplete. Request a new link.');
          await api('reset-password', { token: resetToken, newPassword: data.password });
          history.replaceState({}, '', location.pathname); view = 'login'; render(); status('Password updated. Please sign in.');
        }
      });
    });
    if (config && !config.configured) status(unavailableMessage);
    else if (configurationError) status(configurationError, true);
    else if (config && view === 'delete' && !config.accountDeletion) status('Account deletion is temporarily unavailable. Contact us for help.', true);
    else if (config && !config.emailRegistration && ['register', 'forgot'].includes(view)) status('Email delivery is not configured yet. Please use Google sign-in if available.', true);
  }
  async function action(fn) {
    if (busy || !config?.configured) return; busy = true;
    dialog.querySelectorAll('button,input').forEach(el => el.disabled = true);
    status('Please wait…');
    try { await fn(); } catch (error) { status(frenchAccountCopy[error.message] ? error.message : 'Account service is unavailable. You can still compress PDFs without an account.', true); }
    finally { busy = false; dialog.querySelectorAll('input,.account-close,[data-account-view],[data-account-logout]').forEach(el => el.disabled = false);
      const google = dialog.querySelector('[data-account-google]'); if (google) google.disabled = !config?.google;
      const submit = dialog.querySelector('[type="submit"]'); if (submit) submit.disabled = submissionDisabled();
    }
  }
  async function open({ forDownload = false } = {}) {
    downloadIntent = forDownload;
    view = user ? 'account' : 'login'; render(); dialog.showModal();
    if (!config) {
      status('Connecting to account service…');
      await configurationReady;
      // Preserve the selected view if someone navigated while discovery was pending.
      render();
    }
  }
  document.addEventListener('click', event => { if (event.target.closest('[data-auth-open]')) { event.preventDefault(); open(); } });
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
  // Discover capabilities before requesting any account/session data. An unconfigured
  // deployment returns HTTP 200 here and makes no further account network requests.
  const configurationReady = api('config').then(async settings => {
    if (typeof settings.configured !== 'boolean' || typeof settings.google !== 'boolean' || typeof settings.emailRegistration !== 'boolean' || typeof settings.passwordReset !== 'boolean') throw new Error(unavailableMessage);
    config = settings;
    if (dialog.open) render();
    if (config.configured) {
      // Session calls contain account metadata only; never pass selected files here.
      try { const session = await api('get-session'); user = session?.user || null; updateTriggers(); onUserChange(user); } catch { /* download checks retry the session */ }
    }
  }).catch(error => { configurationError = frenchAccountCopy[error.message] ? error.message : unavailableMessage; if (dialog.open) render(); });
  if (isReset || ['error', 'verified', 'deleted'].includes(query.get('account'))) {
    open().then(() => {
      if (!config?.configured) return;
      if (isReset) { view = 'reset'; render(); if (!resetToken) status('Your reset link is invalid or expired. Request a new link.', true); }
      else if (query.get('account') === 'deleted') status('Your account has been deleted. You can still compress PDFs without an account.');
      else status(query.get('account') === 'verified' ? 'Email verified. You can now sign in.' : 'Sign-in could not be completed. Please try again.', query.get('account') === 'error');
    });
  }
  return { open, refreshSession, isSignedIn: () => Boolean(user), ready: configurationReady };
}
