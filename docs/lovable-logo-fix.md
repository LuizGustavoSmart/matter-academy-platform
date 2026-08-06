Falta republicar as Edge Functions de e-mail com o código mais recente do branch `Marcos`.

Situação atual, verificada agora:

- Os arquivos estáticos JÁ foram publicados com sucesso. `https://plataforma.matteracademy.ai/logos/matter-academy-email.png` retorna HTTP 200 e é byte a byte idêntico ao arquivo do repositório. O problema do logo quebrado está resolvido do lado dos assets.
- Falta o deploy das Edge Functions. O template de e-mail recebeu uma correção adicional de dark mode depois do último deploy, no commit de merge `d935177`. Enquanto as functions não forem republicadas, os e-mails enviados continuam usando a versão anterior do template.

Sobre a correção de dark mode: as alterações feitas no repositório e as feitas por você foram fundidas em `supabase/functions/_shared/email.ts`. A versão final combina as duas abordagens e não deve ser sobrescrita por uma das versões isoladas. Ela cobre três camadas:

1. `background-image: linear-gradient(cor, cor)` em todos os elementos com fundo, aplicado pelo helper `bg()`. O Outlook reescreve `background-color` no modo escuro, mas não reescreve `background-image`, então o gradiente pinta a cor real por cima da substituição.
2. Atributo `bgcolor=` em todos os elementos de tabela, para o Outlook desktop (engine do Word), que ignora fundo definido via CSS.
3. Regras `[data-ogsb]` / `[data-ogsc]` com cores explícitas, mais um bloco `@media (prefers-color-scheme: dark)`. Essas regras são geradas programaticamente a partir das mesmas constantes usadas no HTML, para que as classes e as cores não possam divergir.

Também foi alterado o `<meta name="color-scheme">` de `"dark light"` para `"dark"`, e o mesmo em `supported-color-schemes`. Declarar suporte aos dois temas convida o cliente a converter o e-mail; declarar apenas `dark` sinaliza que ele já está no tema correto e deve ser deixado como está.

Pedido:

1. Republicar as duas Edge Functions a partir do código atual do branch `Marcos`:

   ```
   supabase functions deploy admin-users
   supabase functions deploy auth-public
   ```

   Garantir que `supabase/functions/_shared/email.ts` vá junto, pois é um módulo compartilhado importado pelas duas.

2. Confirmar que o deploy pegou o commit `d935177` (ou posterior) do branch `Marcos`.

3. Enviar um convite de teste (criar um usuário no admin com um e-mail real) e verificar, abrindo no Outlook com tema escuro ativo:
   - o logo aparece no topo;
   - o fundo permanece no preto da marca (`#0b0c0e`), sem virar cinza;
   - o botão continua verde-limão com texto escuro.

4. Se após esse deploy o fundo ainda aparecer cinza em alguma versão do Outlook, favor reportar em qual cliente e versão exatos, em vez de aplicar uma nova correção por cima. As três camadas acima já são a defesa mais forte disponível para e-mail dark; se ainda assim falhar, a decisão seguinte seria migrar o template para fundo claro, e essa é uma escolha de design que precisa ser validada antes.
