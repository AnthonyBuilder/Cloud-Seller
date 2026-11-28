<script setup lang="ts">
useHead({
  title: 'Política de Privacidade - Cloud Seller',
  meta: [{ name: 'description', content: 'Como o Cloud Seller coleta, usa, compartilha e protege dados pessoais, conforme a LGPD.' }],
})
const company = useCompany()
const trashDays = TRASH_RETENTION_DAYS
</script>

<template>
  <LegalPage
    eyebrow="PRIVACIDADE E LGPD"
    title="Política de Privacidade"
    intro="Explicamos quais dados tratamos, por que, com quem compartilhamos e como você exerce seus direitos, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018)."
  >
    <h2>1. Quem é o controlador</h2>
    <p>{{ company.name }}, CNPJ {{ company.cnpj }}, {{ company.address }}. O encarregado pelo tratamento de dados pessoais (DPO) pode ser contatado em {{ company.dpoEmail }}.</p>

    <h2>2. Quais dados tratamos</h2>
    <ul>
      <li><strong>Conta:</strong> e-mail e senha (a senha é guardada pelo Amazon Cognito, de forma protegida, e nós não a vemos). Se ativar a verificação em duas etapas, o Cognito guarda o segredo do autenticador.</li>
      <li><strong>Arquivos:</strong> o conteúdo que você envia, nomes, pastas, tamanho e datas. Não abrimos seus arquivos para outros fins que não a prestação do serviço.</li>
      <li><strong>Assinatura e pagamento:</strong> plano, ciclo, status e identificadores do pagamento. Os dados de cartão são tratados diretamente pelo Mercado Pago ou pelo Stripe e não passam por nossos servidores.</li>
      <li><strong>Aplicativo de backup:</strong> nome do computador que você define, pastas escolhidas (apenas na sua máquina) e os arquivos enviados.</li>
      <li><strong>Dados técnicos:</strong> endereço IP, país aproximado (usado para escolher a moeda), navegador e registros de acesso e de erros, para segurança e funcionamento.</li>
      <li><strong>Comunicação:</strong> mensagens que você nos envia pela página de contato.</li>
    </ul>

    <h2>3. Para que usamos e em que base legal</h2>
    <ul>
      <li>Criar e manter sua conta, armazenar e entregar seus arquivos: execução do contrato.</li>
      <li>Cobrar, emitir comprovantes e cumprir obrigações fiscais: execução do contrato e obrigação legal.</li>
      <li>Segurança, prevenção a fraudes e abusos: legítimo interesse.</li>
      <li>Responder suas solicitações e suporte: execução do contrato e legítimo interesse.</li>
      <li>Registrar o aceite dos Termos e desta Política (versão e data): cumprimento de obrigação e exercício regular de direitos.</li>
    </ul>
    <p>Não vendemos dados pessoais e não usamos o conteúdo dos seus arquivos para publicidade.</p>

    <h2>4. Com quem compartilhamos</h2>
    <p>Usamos operadores que tratam dados em nosso nome: Amazon Web Services (armazenamento dos arquivos, banco de dados e autenticação), Vercel (hospedagem do site), Stripe e Mercado Pago (pagamentos). Também podemos compartilhar dados quando a lei ou uma ordem judicial exigir.</p>

    <h2>5. Transferência internacional</h2>
    <p>Alguns desses fornecedores operam fora do Brasil, incluindo os Estados Unidos, onde seus dados e arquivos podem ser armazenados e processados. Adotamos fornecedores que oferecem salvaguardas contratuais compatíveis com a LGPD.</p>

    <h2>6. Por quanto tempo guardamos</h2>
    <p>Mantemos seus dados enquanto sua conta existir. Arquivos excluídos ficam na lixeira por {{ trashDays }} dias e depois são apagados. Após o encerramento da conta ou do plano, os arquivos seguem o prazo descrito nos <NuxtLink to="/termos">Termos de Uso</NuxtLink>. Dados fiscais e de cobrança podem ser guardados pelo prazo exigido em lei. Registros técnicos são mantidos por [PRAZO A DEFINIR, ex.: 6 meses].</p>

    <h2>7. Como protegemos</h2>
    <p>Conexões usam HTTPS. Cada conta acessa apenas o seu próprio espaço de arquivos, e o envio e o download usam links temporários. Oferecemos verificação em duas etapas opcional. Mesmo assim, nenhum sistema é totalmente imune, e avisaremos você e a ANPD em caso de incidente relevante, nos termos da lei.</p>

    <h2>8. Seus direitos</h2>
    <p>Você pode pedir confirmação do tratamento, acesso, correção, anonimização ou eliminação de dados desnecessários, portabilidade, informação sobre compartilhamento, revogação de consentimento e revisão de decisões automatizadas, conforme o art. 18 da LGPD. Escreva para {{ company.dpoEmail }}. Também é possível reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</p>

    <h2>9. Cookies e armazenamento no navegador</h2>
    <p>Usamos apenas itens necessários ao funcionamento: o cookie <code>cs_currency</code> (lembra a moeda), o cookie <code>cs_interval</code> (lembra mensal ou anual) e o armazenamento local do navegador, onde fica sua sessão de login. Não usamos cookies de publicidade. Se passarmos a usar ferramentas de medição de audiência, atualizaremos esta página.</p>

    <h2>10. Crianças e adolescentes</h2>
    <p>O serviço não é destinado a menores de 18 anos sem representação de responsável legal.</p>

    <h2>11. Mudanças nesta Política</h2>
    <p>Podemos atualizar esta Política. Quando a mudança for relevante, avisaremos por e-mail ou no painel.</p>
  </LegalPage>
</template>
