// Preparado para integração após conferir a função manage-users.
// makeClient deve criar um cliente de autenticação isolado:
// persistSession:false, autoRefreshToken:false, detectSessionInUrl:false.
export function createFirstAccess(React, makeClient) {
  const h = React.createElement;
  return function FirstAccess({ onBack }) {
    const [client] = React.useState(makeClient);
    const [email, setEmail] = React.useState('');
    const [token, setToken] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [confirmation, setConfirmation] = React.useState('');
    const [verified, setVerified] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [message, setMessage] = React.useState('');
    const lock = React.useRef(false);
    async function submit(event) {
      event.preventDefault();
      if (lock.current) return;
      lock.current = true; setBusy(true); setMessage('');
      try {
        if (!verified) {
          const result = await client.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'invite' });
          if (result.error || !result.data?.session) throw Error('Código inválido ou vencido. Confira o e-mail e o código recebido.');
          setVerified(true); setToken('');
        } else {
          if (password.length < 12 || password !== confirmation) throw Error('Use ao menos 12 caracteres e confirme a mesma senha.');
          const result = await client.auth.updateUser({ password });
          if (result.error) throw Error('Não foi possível salvar a senha. Confira os requisitos e tente novamente.');
          setPassword(''); setConfirmation('');
          await client.auth.signOut({ scope: 'local' });
          onBack('Senha criada. Entre com seu e-mail e sua senha.');
        }
      } catch (error) { setMessage(error.message); }
      finally { lock.current = false; setBusy(false); }
    }
    const input = (label, props) => h('label', null, label, h('input', { required: true, disabled: busy, ...props }));
    return h('section', { className: 'panel auth-card' },
      h('h1', null, 'Primeiro acesso — criar senha'),
      h('form', { onSubmit: submit },
        verified ? h(React.Fragment, null,
          input('Nova senha (mínimo 12 caracteres)', { type: 'password', autoComplete: 'new-password', minLength: 12, value: password, onChange: e => setPassword(e.target.value) }),
          input('Confirmar senha', { type: 'password', autoComplete: 'new-password', value: confirmation, onChange: e => setConfirmation(e.target.value) }))
          : h(React.Fragment, null,
            input('E-mail cadastrado', { type: 'email', autoComplete: 'email', value: email, onChange: e => setEmail(e.target.value) }),
            input('Código recebido por e-mail', { inputMode: 'numeric', autoComplete: 'one-time-code', value: token, onChange: e => setToken(e.target.value) })),
        h('button', { className: 'primary', disabled: busy }, busy ? 'Aguarde…' : verified ? 'Criar minha senha' : 'Confirmar código')),
      message && h('p', { role: 'status' }, message),
      h('button', { disabled: busy, onClick: async () => { await client.auth.signOut({ scope: 'local' }); onBack(''); } }, 'Voltar ao login'));
  };
}
