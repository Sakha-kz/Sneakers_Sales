export const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')

export const formatPrice = (price: number, language: string) =>
  new Intl.NumberFormat(language === 'kk' ? 'kk-KZ' : language === 'ru' ? 'ru-RU' : 'en-US', {
    style: 'currency',
    currency: 'KZT',
    maximumFractionDigits: 0,
  }).format(price)

export const whatsappDigits = (phone: string) => phone.replace(/\D/g, '')
