// Dados da empresa para os documentos legais. Valores ausentes viram marcadores visíveis
// para não publicar um documento incompleto sem perceber.
export function useCompany() {
  const config = useRuntimeConfig()
  const pub = config.public
  return {
    name: String(pub.companyName || '') || '[RAZÃO SOCIAL]',
    cnpj: String(pub.companyCnpj || '') || '[CNPJ]',
    address: String(pub.companyAddress || '') || '[ENDEREÇO]',
    supportEmail: String(pub.supportEmail || '') || '[E-MAIL DE SUPORTE]',
    dpoEmail: String(pub.dpoEmail || '') || String(pub.supportEmail || '') || '[E-MAIL DO ENCARREGADO]',
    isDraft: pub.legalDraft === true || String(pub.legalDraft) === 'true',
    configured: Boolean(pub.companyName && pub.companyCnpj),
  }
}
