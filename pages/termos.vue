<script setup lang="ts">
useHead({
  title: 'Termos de Uso - Cloud Seller',
  meta: [{ name: 'description', content: 'Regras de uso, cobrança, cancelamento e responsabilidades do serviço Cloud Seller.' }],
})
const company = useCompany()
const trashDays = TRASH_RETENTION_DAYS
</script>

<template>
  <LegalPage
    eyebrow="TERMOS DE USO"
    title="Termos de Uso do Cloud Seller"
    intro="Estas regras valem para quem cria uma conta e usa o armazenamento, o painel e o aplicativo de backup do Cloud Seller."
  >
    <h2>1. Quem somos e o que oferecemos</h2>
    <p>O Cloud Seller é um serviço de armazenamento de arquivos online operado por {{ company.name }}, CNPJ {{ company.cnpj }} ("nós"). O serviço inclui o painel web, planos de armazenamento e o aplicativo de backup automático para computador. Ao criar uma conta, você declara que leu e aceita estes Termos e a <NuxtLink to="/privacidade">Política de Privacidade</NuxtLink>.</p>

    <h2>2. Conta e segurança</h2>
    <p>Você deve ter 18 anos ou mais, ou ser representado por responsável legal. Informe um e-mail válido e mantenha sua senha em sigilo. Recomendamos ativar a verificação em duas etapas em "Minha conta". Você é responsável pelas atividades feitas na sua conta. Avise-nos imediatamente se suspeitar de acesso indevido.</p>

    <h2>3. Planos, preços e cobrança</h2>
    <p>Os planos, a capacidade e os preços ficam publicados na página de planos, em reais (BRL), dólares (USD) ou euros (EUR), conforme o país e a moeda escolhida. As assinaturas podem ser mensais ou anuais, e se renovam automaticamente até serem canceladas. A cobrança em reais é processada pelo Mercado Pago e as demais pelo Stripe. Não armazenamos os dados do seu cartão.</p>
    <p>Podemos reajustar preços para novas contratações a qualquer momento. Para assinaturas ativas, o reajuste só vale na próxima renovação e será comunicado por e-mail com antecedência mínima de [30] dias. Se não concordar, você pode cancelar antes da renovação.</p>
    <p>Capacidades usam unidades decimais (1 GB = 1.000 MB). O limite de tamanho por arquivo enviado é de 5 GB.</p>

    <h2>4. Teste gratuito</h2>
    <p>Quando disponível, o teste gratuito dura 24 horas, não exige cartão e não renova sozinho em plano pago. Ao final, a conta passa a funcionar somente para visualização e download até a contratação de um plano.</p>

    <h2>5. Uso aceitável</h2>
    <p>É proibido usar o Cloud Seller para armazenar ou compartilhar conteúdo ilegal, que viole direitos autorais ou de terceiros, malware, ou material que exponha crianças e adolescentes. Também é proibido tentar acessar contas de outras pessoas, burlar limites do plano, revender o espaço sem autorização ou usar o serviço de forma que prejudique a estabilidade para os demais clientes, incluindo volume de downloads muito acima do uso normal. Podemos suspender ou encerrar contas que violem estas regras, com aviso quando possível.</p>

    <h2>6. Lixeira e exclusão de arquivos</h2>
    <p>Arquivos e pastas que você exclui no painel vão para a lixeira e ficam disponíveis para restauração por {{ trashDays }} dias. Depois disso, são apagados definitivamente e não podem ser recuperados. Itens na lixeira ocupam espaço do seu plano até serem excluídos. Você também pode esvaziar a lixeira a qualquer momento.</p>

    <h2>7. Aplicativo de backup</h2>
    <p>O aplicativo Cloud Seller Backup envia as pastas que você escolher para o seu armazenamento, mantendo uma cópia atual e versões diárias dos arquivos alterados. Por padrão, o histórico de versões é mantido por 30 dias e esse prazo pode ser ajustado no aplicativo. Cópias e versões ocupam espaço do seu plano. Arquivos apagados do seu computador não apagam a cópia atual na nuvem. O backup só roda se o computador estiver ligado, com internet e com o aplicativo conectado à sua conta. Confira periodicamente se o backup está concluindo.</p>

    <h2>8. Cancelamento, inadimplência e retenção de arquivos</h2>
    <p>Você pode cancelar a assinatura quando quiser, pelo painel. O acesso ao plano segue até o fim do período já pago. Em caso de falha de pagamento, novos envios poderão ser bloqueados. Após o cancelamento ou o fim do período, seus arquivos ficam disponíveis para download por [PRAZO A DEFINIR, ex.: 60] dias. Depois desse prazo, os arquivos poderão ser excluídos, e avisaremos por e-mail antes disso. Faça o download do que for importante.</p>

    <h2>9. Disponibilidade e responsabilidade</h2>
    <p>Trabalhamos para manter o serviço disponível e seguro, mas não garantimos funcionamento ininterrupto nem ausência total de falhas. O Cloud Seller não substitui uma política própria de cópias de segurança: recomendamos manter uma cópia dos seus arquivos mais importantes em outro local. Na máxima extensão permitida pela lei, nossa responsabilidade fica limitada ao valor pago por você nos últimos [12] meses, sem prejuízo dos seus direitos como consumidor previstos no Código de Defesa do Consumidor.</p>

    <h2>10. Propriedade e conteúdo</h2>
    <p>Seus arquivos continuam sendo seus. Você nos autoriza apenas a armazená-los, copiá-los e entregá-los a você para prestar o serviço. Não analisamos o conteúdo dos arquivos para fins de publicidade.</p>

    <h2>11. Alterações destes Termos</h2>
    <p>Podemos atualizar estes Termos. Mudanças relevantes serão avisadas por e-mail ou no painel antes de valerem. Continuar usando o serviço após esse prazo significa concordância com a nova versão.</p>

    <h2>12. Lei aplicável e contato</h2>
    <p>Estes Termos seguem a lei brasileira. Fica eleito o foro do domicílio do consumidor para dúvidas e conflitos. Para falar conosco, escreva para {{ company.supportEmail }} ou use a página de <NuxtLink to="/contato">contato</NuxtLink>.</p>
  </LegalPage>
</template>
