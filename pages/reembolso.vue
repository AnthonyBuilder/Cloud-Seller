<script setup lang="ts">
useHead({
  title: 'Cancelamento e Reembolso - Cloud Seller',
  meta: [{ name: 'description', content: 'Como cancelar sua assinatura, direito de arrependimento de 7 dias e regras de reembolso do Cloud Seller.' }],
})
const company = useCompany()
</script>

<template>
  <LegalPage
    eyebrow="CANCELAMENTO E REEMBOLSO"
    title="Cancelamento e reembolso"
    intro="Você pode desistir da compra em até 7 dias e cancelar a renovação quando quiser."
  >
    <h2>1. Direito de arrependimento (7 dias)</h2>
    <p>Como a contratação é feita pela internet, você pode desistir em até 7 dias corridos contados da primeira cobrança de uma assinatura, conforme o art. 49 do Código de Defesa do Consumidor. Nesse caso devolvemos o valor integral pago, sem perguntas. Isso vale para planos mensais e anuais.</p>

    <h2>2. Como cancelar</h2>
    <p>Entre na sua conta, abra "Plano e pagamento" e escolha cancelar. A renovação seguinte deixa de ser cobrada e o plano continua ativo até o fim do período já pago. Também é possível pedir o cancelamento escrevendo para {{ company.supportEmail }}.</p>

    <h2>3. Depois dos 7 dias</h2>
    <p>Passado o prazo de arrependimento, o cancelamento evita as próximas cobranças, mas o período já iniciado não é reembolsado proporcionalmente [CONFIRMAR POLÍTICA]. Em planos anuais, o acesso permanece até o fim dos 12 meses pagos.</p>

    <h2>4. Cobranças indevidas</h2>
    <p>Se você foi cobrado por engano, em duplicidade ou depois de cancelar, devolvemos o valor. Envie os dados da cobrança para {{ company.supportEmail }}.</p>

    <h2>5. Como o reembolso é feito</h2>
    <p>O valor volta pelo mesmo meio de pagamento usado na compra, pelo Mercado Pago ou pelo Stripe. O prazo para aparecer na fatura ou na conta depende do seu banco ou operadora, normalmente de poucos dias até duas faturas.</p>

    <h2>6. Seus arquivos após o cancelamento</h2>
    <p>Depois do cancelamento ou do reembolso, você pode baixar seus arquivos pelo prazo informado nos <NuxtLink to="/termos">Termos de Uso</NuxtLink>. Faça o download antes de esse prazo acabar.</p>
  </LegalPage>
</template>
