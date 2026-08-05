O logo não está aparecendo nos e-mails transacionais (convite, reconvite e redefinição de senha) enviados pelo Resend.

Causa: o e-mail referencia `https://plataforma.matteracademy.ai/logos/matter-academy-email.png`, mas esse arquivo ainda não está publicado no domínio de produção (retorna 404 hoje). Ele existe no repositório em `public/logos/matter-academy-email.png`, no branch `Marcos`, mas depende de um deploy/sync desse branch para ir ao ar.

Anexo o vetor oficial do lockup (`matter-academy-negative.svg`) para conferência. Ele já está versionado em `public/logos/matter-academy-negative.svg` no mesmo branch.

Pedido:

1. Fazer o deploy/sync do branch `Marcos` para produção, garantindo que os arquivos abaixo fiquem acessíveis publicamente:
   - `https://plataforma.matteracademy.ai/logos/matter-academy-email.png`
   - `https://plataforma.matteracademy.ai/logos/matter-academy-negative.svg`

2. Depois do deploy, confirmar que a URL acima do PNG retorna HTTP 200 e mostra o logo (triângulo verde-limão + "matter academy" em cinza-claro, sem fundo).

3. Reenviar um convite de teste (criar um usuário no admin com um e-mail real) e confirmar visualmente que o logo aparece no topo do e-mail.

Observação: o PNG é a versão usada especificamente nos e-mails — clientes de e-mail (Gmail, Outlook) não renderizam SVG, então esse arquivo é uma versão já rasterizada e recortada do SVG oficial, criada a partir dele. Não precisa gerar um PNG novo, só publicar o que já está no repositório.
