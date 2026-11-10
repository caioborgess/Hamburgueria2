# Fagulha · pagamentos
Abra dist/index.html para apresentar a demonstração. Monte um pedido para retirada, clique em Revisar pedido e em Simular pagamento e acompanhar. A prévia mostra o valor e não efetua cobrança.

## Para o estabelecimento
O projeto usa Mercado Pago Checkout Pro. O botão inicia no site e o pagamento acontece no ambiente do Mercado Pago. As tarifas e o prazo de recebimento dependem da conta da hamburgueria. A entrega soma o frete por bairro ao total. As taxas iniciais são fictícias. Em dist/data.js, substitua deliveryZones pela área real, em centavos, e marque deliveryVerified como true somente depois de conferir com o estabelecimento. Sem confirmação, cobranças reais ficam limitadas à retirada. Se o estabelecimento usar taxa única, repita o mesmo valor nos bairros atendidos. Reinicie o servidor depois de editar os preços.

## Ativação
Use Node.js 24 com SQLite e hospede servidor.cjs e balcao.cjs junto da pasta dist em um serviço com HTTPS e disco persistente. Uma hospedagem apenas de HTML, como GitHub Pages, oferece somente a demonstração. Execute node servidor.cjs na pasta do projeto. Configure no ambiente do servidor:
- MP_ACCESS_TOKEN: credencial privada de teste da aplicação da hamburgueria. Use a credencial de produção somente após homologar. Nunca coloque o token no HTML, no ZIP enviado ao cliente, no chat ou no repositório.
- BALCAO_PASSWORD: senha exclusiva da equipe, com pelo menos 16 caracteres. O usuário do painel é balcao. Configure no servidor e acesse o painel por HTTPS.
- MP_WEBHOOK_SECRET: assinatura secreta do webhook da aplicação do Mercado Pago. No painel da aplicação, configure o evento de pagamentos para PUBLIC_ORIGIN/api/notificacoes/mercado-pago no ambiente correspondente. Teste o recebimento antes de ativar produção.
- PUBLIC_ORIGIN: origem HTTPS real que serve o site, sem barra no fim. O servidor usa essa origem para o retorno do checkout.
- PORT e HOST: porta e interface de escuta do serviço. O padrão local é 127.0.0.1 na porta 4195. Em hospedagem que exige escuta externa, use HOST=0.0.0.0.
- ORDER_DB_PATH: arquivo SQLite em volume privado e persistente, fora de dist. Restrinja o acesso e defina com a hamburgueria prazos de retenção e exclusão. Este modelo utiliza uma instância de servidor.

Antes de habilitar vendas, configure no catálogo e na página a empresa, o contato, os preços, os avisos de privacidade e as condições reais de retirada. Com credenciais de teste, use as contas e os meios de pagamento de teste do Mercado Pago. Verifique aprovação, pendência, recusa e retorno; depois valide o recebimento na conta correta. A página de retorno consulta a API do provedor. Uma visita ao endereço de sucesso sozinha não comprova pagamento.

O dono abre /balcao no mesmo domínio e entra com o usuário da equipe. Com o painel aberto, as comandas pagas são atualizadas a cada oito segundos. Uma nova comanda gera um aviso visual na tela. O webhook é validado, e o servidor consulta a API do Mercado Pago para conferir o valor, a moeda e o pedido. Assim a comanda pode chegar mesmo se o comprador fechar o checkout. O link individual do cliente é somente de leitura. O cliente recebe o retorno após o checkout e pode reabrir o último acompanhamento em Meu pedido, no mesmo navegador. O atendimento por WhatsApp é opcional e independente. No HTML offline as etapas são simuladas na própria aba, sem cobrança ou notificação externa.

Como alternativa de conferência administrativa, para listar os 50 pedidos mais recentes, execute node servidor.cjs --pedidos no ambiente privado do servidor, com a mesma configuração da loja. O comando consulta os pagamentos no provedor inclusive quando o comprador fecha o navegador antes de retornar. Confira o estado aprovado antes de preparar o pedido. As observações e o nome ficam no registro privado do pedido iniciado, e o cartão é informado diretamente ao Mercado Pago.

Documentação oficial: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/overview

CEP: configure deliveryCity, deliveryState e deliveryZones em dist/data.js. São Paulo – SP é a cidade ilustrativa. O ViaCEP localiza o endereço; a taxa vem da tabela de bairros. Use 01001-000 para testar Sé. A digitação manual funciona sem conexão.
