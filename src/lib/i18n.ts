import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const resources = {
  en: {
    translation: {
      appName: 'ShopReel',
      shell: {
        tagline: 'Discover what is worth adding to your bag.',
        comingSoon: 'This space is ready for the next phase.',
      },
      nav: {
        feed: 'Feed',
        wishlist: 'Wishlist',
        create: 'Create',
        bag: 'Bag',
        me: 'Me',
      },
    },
  },
  hi: {
    translation: {
      appName: 'ShopReel',
      shell: {
        tagline: 'अपने बैग में जोड़ने लायक चीज़ें खोजें।',
        comingSoon: 'यह जगह अगले चरण के लिए तैयार है।',
      },
      nav: {
        feed: 'फ़ीड',
        wishlist: 'विशलिस्ट',
        create: 'बनाएँ',
        bag: 'बैग',
        me: 'मैं',
      },
    },
  },
} as const

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n
