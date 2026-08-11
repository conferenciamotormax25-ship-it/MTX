# MTX — push gratuito, sem plano Blaze

Esta versão usa Firebase Cloud Messaging + GitHub Actions. Não usa Cloud Functions e não exige ativar faturamento.

## Funcionamento

- O GitHub verifica os pedidos a cada 15 minutos, de segunda a sexta.
- Pedidos novos pendentes geram push na próxima verificação.
- Também há lembretes às 09:00, 12:00, 15:00 e 17:00.
- O push aparece mesmo quando a página está fechada.
- O GitHub pode atrasar uma execução agendada em momentos de maior carga.

## 1. Criar a credencial usada somente pelo GitHub

ATENÇÃO: não envie esta credencial pelo chat e não coloque o arquivo JSON dentro do repositório.

1. Abra Firebase > Configurações do projeto > Contas de serviço.
2. Clique em **Gerar nova chave privada**.
3. Confirme e salve o arquivo JSON em local seguro.
4. Abra o arquivo JSON no Bloco de Notas e copie todo o conteúdo.

## 2. Guardar a credencial como segredo no GitHub

1. Abra o repositório `conferenciamotormax25-ship-it/MTX`.
2. Entre em **Configurações**.
3. No menu esquerdo, abra **Segredos e variáveis > Ações**.
4. Clique em **Novo segredo do repositório**.
5. Nome: `FIREBASE_SERVICE_ACCOUNT`
6. Valor: cole todo o conteúdo do JSON.
7. Salve.

O segredo fica protegido pelo GitHub. Nunca adicione o JSON como arquivo do repositório.

## 3. Atualizar os arquivos no GitHub

Na branch padrão `principal`, coloque estes itens na raiz do repositório:

- `index.html` — substitui o antigo.
- `firebase-messaging-sw.js` — fica ao lado do `index.html`.
- pasta `automation` completa.
- pasta `.github` completa.

Confirme o upload/commit e aguarde o GitHub Pages publicar a nova versão.

## 4. Ativar o push em cada computador

1. Abra `https://conferenciamotormax25-ship-it.github.io/MTX/`.
2. Pressione `Ctrl + F5`.
3. Clique em **ATIVAR LEMBRETES**.
4. Clique em **Permitir** quando o navegador perguntar.
5. Repita em todos os computadores que devem receber push.

Se aparecer erro de permissão, consulte `REGRA-FIRESTORE-PUSH.txt`. Não substitua todas as regras sem antes conferir as regras existentes.

## 5. Fazer um teste manual

1. No GitHub, abra a aba **Ações**.
2. Escolha **Push gratuito de pedidos pendentes**.
3. Clique em **Executar fluxo de trabalho**.
4. Mantenha **Enviar uma notificação de teste agora** marcado.
5. Execute e aguarde o resultado ficar verde.

## Observações importantes

- Firebase Cloud Messaging é um produto sem custo.
- GitHub Actions é gratuito para repositórios públicos usando máquinas padrão.
- O fluxo agendado pode ser desativado pelo GitHub após 60 dias sem atividade no repositório. Nesse caso, abra **Ações** e reative o fluxo.
- A chave VAPID presente no site é pública. A chave privada da conta de serviço deve existir somente no segredo `FIREBASE_SERVICE_ACCOUNT`.
