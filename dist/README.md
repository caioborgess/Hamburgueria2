# FAGULHA — projeto de estudo e demonstração comercial

Site funcional de uma hamburgueria **fictícia**, feito com HTML, CSS e JavaScript puro. Não usa framework, banco de dados, backend, API paga, instalação de dependências ou compilação.

## 1. Como abrir e testar

1. Extraia o ZIP inteiro, preservando a pasta `assets/`.
2. Abra `index.html` no Chrome, Edge, Firefox ou Safari atualizado.
3. Clique em um produto, personalize e adicione ao pedido.
4. Abra **Meu pedido**, escolha retirada ou entrega e clique em **Revisar pedido**.
5. Sem telefone configurado, o resumo aparece em **modo de demonstração**. Você pode copiá-lo, mas nada é enviado.

Para estudar, use a extensão **Live Server** do VS Code e abra `index.html` com ela. Um endereço HTTP local deixa o comportamento de armazenamento mais previsível que `file://`. Não é preciso instalar pacotes no projeto. Se o navegador bloquear o armazenamento, o site informa a limitação e mantém o carrinho em memória enquanto a página estiver aberta.

Fotos, ilustrações e fontes são locais: o site abre sem internet. O WhatsApp e links externos precisam de conexão. A cópia automática do resumo depende da permissão do navegador; quando indisponível, o texto fica selecionado para cópia manual.

## 2. O papel de cada arquivo

| Arquivo | Responsabilidade |
|---|---|
| `index.html` | Seções, navegação, estrutura dos modais e formulário de entrega |
| `style.css` | Identidade visual, espaçamento, componentes, celular/tablet/desktop e movimento reduzido |
| `data.js` | Nome, cores, contatos, horários, categorias, produtos, preços, fotos e adicionais |
| `script.js` | Cálculos, personalização, armazenamento, renderização, validação e mensagem do WhatsApp |
| `assets/` | Fotos WebP, SVGs, fontes locais, créditos e licenças |

O HTML carrega `data.js` antes de `script.js`, ambos com `defer`. Assim, a lógica encontra o catálogo e a página já construída. Não troque essa ordem.

O fluxo é: **catálogo → personalização → item independente no carrinho → revisão → conversa no WhatsApp**.

## 3. Trocar a marca, as cores e as imagens

Abra `data.js` e edite `brand.name`, `brand.tagline`, `brand.colors`, `brand.address`, `brand.city`, `brand.hours` e `brand.story`. As cores básicas são aplicadas às variáveis CSS `--bg`, `--surface`, `--accent` e `--text`. Ajustes de contraste, fundos secundários e estados ficam em `style.css`.

Para trocar fotos:

1. Coloque seus arquivos em `assets/`, de preferência em WebP.
2. Para o destaque principal, altere `brand.heroImage`.
3. Em cada produto, altere `image`, por exemplo: `image: 'assets/meu-hamburguer.webp'`.
4. Prefira fotos de 700–900 px para cards e até 1600 px para o hero. O navegador carrega as imagens abaixo da primeira tela sob demanda.
5. Atualize descrições alternativas no HTML quando mudar o assunto da imagem principal ou da seção Sobre.

O logo tipográfico recebe o nome do catálogo. O ícone da chama está no cabeçalho e em `assets/favicon.svg`. Os textos de campanha, o selo, a legenda do hero e a composição gráfica da seção Sobre são conteúdo editorial em `index.html`; adapte-os para a nova marca. As referências diretas à FAGULHA nesses textos também devem ser atualizadas.

**Este projeto permanece explicitamente fictício mesmo com um número configurado.** Para reutilizá-lo em uma empresa real, substitua todos os avisos e dados demonstrativos somente depois de obter os dados verdadeiros e a autorização da empresa. Não invente avaliações, horários, endereços ou promessas.

## 4. Produtos, categorias, preços e adicionais

Todos os valores são **centavos inteiros**. `2990` representa R$ 29,90; não escreva `29.90`.

Um produto segue esta estrutura:

```js
{
  id: 'burger-novo',                  // Identificador único e estável
  name: 'Meu Hambúrguer',
  category: 'burgers',                // ID existente em categories
  price: 3290,
  description: 'Uma descrição curta e concreta.',
  ingredients: ['Pão', 'Carne', 'Queijo', 'Cebola'],
  removable: ['Queijo', 'Cebola'],     // Apenas ingredientes originais
  extras: ['bacon', 'cheese'],         // IDs existentes em extras
  image: 'assets/meu-hamburguer.webp',
  badge: 'NOVIDADE',                  // Opcional
  featured: true                      // Opcional; aparece nos destaques
}
```

- Para criar um adicional, adicione uma entrada em `extras`, como `egg: { name: 'Ovo', price: 300 }`, e inclua seu ID apenas nos produtos compatíveis.
- Use `extras: []` para não oferecer adicionais. Bebidas e sobremesas já seguem essa regra.
- `removable` lista os ingredientes que o cliente pode retirar; a retirada não dá desconto. Componentes fixos, como a carne do hambúrguer, continuam aparecendo na lista completa.
- Adicionais são selecionados uma vez por unidade. Se a quantidade for 2, os adicionais escolhidos são cobrados nas duas unidades.
- Para duas unidades diferentes, adicione cada versão separadamente. Cada inclusão cria uma linha independente, mesmo quando o produto é o mesmo.
- A quantidade por linha vai de 1 a 99; há limite de 50 linhas por pedido para evitar armazenamento exagerado.
- Combos têm componentes definidos na descrição. Não há escolha de bebida do combo; para oferecer isso, cadastre variantes claras ou amplie o modelo.
- Novas categorias entram em `categories`, com `id`, `name` e `symbol`.

### Entendendo o cálculo

`unitPrice()` soma o preço base e os adicionais. `subtotal()` multiplica esse resultado pela quantidade. `total()` soma todas as linhas. A divisão por 100 acontece somente em `money()`, na hora de exibir moeda. Isso evita somar valores monetários decimais.

Exemplo: `(2990 + 500 + 350) × 2 = 7680`, exibido como **R$ 76,80**.

### Como o carrinho é salvo

`localStorage` salva IDs, quantidade, adicionais, remoções e observações, além da assinatura do catálogo. `normalizeCart()` revalida tudo na restauração: descarta produtos excluídos, ignora adicionais incompatíveis, limita quantidades e recalcula pelos preços atuais. Se o catálogo mudar, o usuário recebe um aviso para revisar o pedido.

Nome e endereço não são salvos. Observações dos produtos fazem parte do carrinho e permanecem no navegador; evite colocar informações sensíveis nelas. Esvaziar o carrinho limpa os itens salvos. O pedido continua no carrinho depois de abrir o WhatsApp, pois o site não sabe se houve envio.

### Segurança do texto e acessibilidade

`escapeHTML()` transforma caracteres especiais em texto antes de preencher templates. Dados pessoais são usados com `.value` ou como texto da mensagem. Não remova esse tratamento e não passe observações diretamente para `innerHTML`.

Os modais usam `<dialog>` nativo: o foco fica dentro da janela, Escape fecha e o foco retorna ao botão de origem. Formulários têm labels, avisos e campos obrigatórios. O CSS respeita `prefers-reduced-motion`.

## 5. Configurar o WhatsApp

Em `data.js`, preencha `brand.whatsapp` com o **número real autorizado** do restaurante, em formato internacional, somente dígitos: código do país + DDD + número. Para o Brasil, o prefixo é `55`. Não inclua `+`, espaços, parênteses ou hífens. O valor inicial é vazio de propósito.

O site verifica o formato (8 a 15 dígitos, sem zero inicial), mas não pode confirmar a existência da conta. Valide o destino com o responsável pela empresa.

A revisão gera:

```js
'https://wa.me/' + numero + '?text=' + encodeURIComponent(mensagem)
```

O botão **Finalizar pelo WhatsApp** abre a conversa em outra aba com texto preenchido. O consumidor confere e toca em **Enviar** dentro do WhatsApp. O site não envia automaticamente e não confirma recebimento.

Enquanto o número estiver vazio ou malformado, aparece **Copiar pedido de demonstração**. Não há redirecionamento para um número fictício.

A mensagem contém nome, quantidade, adicionais com preços, remoções, observações, preço unitário, subtotal por item, total estimado, modalidade e endereço quando necessário. Disponibilidade, taxa de entrega e preço final devem ser confirmados.

## 6. Publicar em hospedagem estática

Publique o conteúdo desta pasta preservando os caminhos:

```text
index.html
style.css
data.js
script.js
assets/
README.md
```

Não existe etapa de build. O diretório publicado deve conter `index.html` na raiz. Qualquer serviço que entregue arquivos estáticos por HTTPS é suficiente. Se usar GitHub Pages, publique a pasta escolhida nas configurações Pages do repositório. Se usar uma hospedagem com envio de arquivos, envie esta estrutura para a pasta pública indicada pelo serviço.

Depois de publicar, teste o site no endereço definitivo, confira arquivos e imagens e valide o destino do WhatsApp antes de divulgar. Carrinhos são separados por navegador e domínio; o carrinho local não será transferido para o domínio publicado.

## 7. Checklist para repetir os testes

### Cardápio e personalização

- [ ] Ver 3 hambúrgueres, 2 combos, 2 acompanhamentos, 3 bebidas e 2 sobremesas nos filtros.
- [ ] Abrir um produto por clique e teclado; fechar com X e Escape.
- [ ] Conferir descrição, ingredientes, imagem e preço base.
- [ ] Adicionar bacon a duas unidades de Clássico Fagulha: total **R$ 69,80**.
- [ ] Acrescentar queijo extra às mesmas unidades: total **R$ 76,80**.
- [ ] Retirar cebola e confirmar que o preço não muda.
- [ ] Adicionar duas versões diferentes do mesmo hambúrguer e conferir linhas separadas.
- [ ] Abrir bebida e sobremesa e conferir que não oferecem bacon, ovo ou queijo.
- [ ] Digitar uma observação com `<teste>` e verificar que aparece literalmente.

### Carrinho e persistência

- [ ] Editar adicionais, observações e quantidade e conferir os novos subtotais.
- [ ] Diminuir até 1; conferir que não existe quantidade negativa ou zero.
- [ ] Remover uma linha e conferir total e contador.
- [ ] Recarregar a página: personalizações e quantidades devem persistir; nome e endereço devem ficar vazios.
- [ ] Alterar um preço em `data.js`, recarregar e conferir aviso e valor atualizado.
- [ ] Remover um produto do catálogo e conferir que não reaparece no carrinho salvo.
- [ ] Esvaziar e confirmar o estado vazio; não deve existir finalização disponível.
- [ ] Abrir outra aba, modificar o pedido e conferir sincronização entre abas.

### Retirada e entrega

- [ ] Tentar revisar sem nome: formulário deve impedir.
- [ ] Usar somente espaços no nome: deve aparecer mensagem de erro.
- [ ] Retirada: exigir nome, dispensar endereço e não incluí-lo no resumo.
- [ ] Entrega: exigir nome, rua, número e bairro; complemento opcional.
- [ ] Usar `S/N` no número e conferir aceitação.
- [ ] Conferir que não há cobrança de taxa inventada e que a confirmação é informada.
- [ ] Voltar da entrega para retirada e verificar que o endereço antigo não entra no resumo.

### WhatsApp

- [ ] Número vazio ou inválido: mostrar modo demo e resumo copiável.
- [ ] Configurar um número real autorizado e conferir o resumo antes de abrir a conversa.
- [ ] Conferir acentos, quebras de linha, `&` e `#` na mensagem.
- [ ] Conferir destino no WhatsApp, sem enviar pedidos reais durante um teste não combinado.
- [ ] Confirmar que abrir a conversa não apaga o carrinho nem mostra pedido recebido.

### Responsividade e acessibilidade

- [ ] Inspecionar em 320, 390, 768, 1024 e 1440 px.
- [ ] Conferir menu móvel, filtros com rolagem horizontal e carrinho fixo quando há itens.
- [ ] Garantir que a página não rola horizontalmente; filtros podem rolar dentro da própria faixa.
- [ ] Usar Tab/Shift+Tab para navegar, Enter para ativar e Escape para fechar modais.
- [ ] Conferir foco visível e retorno ao botão de origem.
- [ ] Ativar movimento reduzido no sistema e verificar ausência de transições.
- [ ] Testar em um celular físico com teclado aberto; esse teste complementa a simulação de largura.

## 8. Limitações e evolução

- Não existe estoque em tempo real, pagamento, cálculo de frete, status de pedido, autenticação ou envio automático.
- O navegador armazena apenas o carrinho. Não há sincronização entre dispositivos.
- Validação no cliente ajuda a organizar o pedido; o restaurante ainda deve revisar preços e disponibilidade.
- Mensagens muito extensas podem exceder limites do navegador ou do WhatsApp. Divida pedidos grandes em pedidos menores.
- As imagens são ilustrativas; bebidas, onion rings e a imagem de contingência usam SVGs locais fáceis de substituir. Algumas fotos são reutilizadas entre produtos.
- Para pizzarias com tamanho, massa, borda e meios sabores, será necessário ampliar a estrutura de opções e a regra de preço. Não trate isso como uma simples troca de nome.

Créditos completos e fontes dos arquivos estão em `assets/CREDITOS.md`. Licenças das fontes acompanham os arquivos.

## Acabamento visual

A textura está em `assets/charcoal-grain.svg`, referenciada pela variável `--grain` em `style.css`. O hero usa `mask-image` para fazer a borda da foto desaparecer gradualmente e camadas de `linear-gradient` para preservar o contraste do texto. Há transições próprias para celular (vertical) e computador (horizontal). A textura é estática, local e não bloqueia cliques.

As camadas `embers.svg` (hero) e `embers-soft.svg` (demais seções) acrescentam faíscas estáticas. As cores de brasa e o brilho avermelhado ficam no bloco final de `style.css`. Não há animação contínua ou bibliotecas adicionais.

### Hero sem cenário
O hero usa `assets/burger-hero-cutout.png`, com transparência real. O brilho, o disco com linhas e os aros são feitos em CSS nas classes `.hero-scene` e `.hero-art`; as faíscas continuam em SVG. Para trocar a imagem, prefira PNG/WebP com transparência e atualize `brand.heroImage`.

## Antes da entrega a uma hamburgueria real

Confirme com o cliente a autorização de publicação das fotos e da marca, os ingredientes e preços de cada item. Mantenha os créditos das imagens de terceiros, inclusive das fotos da capa e da história. Identifique o fornecedor com nome empresarial, CPF ou CNPJ conforme aplicável, endereço físico e eletrônico e canal de atendimento. Ajuste o aviso de privacidade ao responsável real, à hospedagem, ao uso do WhatsApp e ao canal para solicitações sobre dados. Informe condições, prazos e eventuais despesas de entrega antes do aceite final. Na demonstração, use dados fictícios e mantenha o telefone vazio.
