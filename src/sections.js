import Skills from './sections/Skills.jsx'
import Ledger from './sections/Ledger.jsx'
import Entries from './sections/Entries.jsx'
import Opening from './sections/Opening.jsx'
import Adjustment from './sections/Adjustment.jsx'
import Subscriptions from './sections/Subscriptions.jsx'
import Balance from './sections/Balance.jsx'
import CreditCard from './sections/CreditCard.jsx'
import Savings from './sections/Savings.jsx'
import Monthly from './sections/Monthly.jsx'
import LedgerBook from './sections/LedgerBook.jsx'

// メニュー定義。セクションを増やすときはここに足すだけ。
export const sections = [
  { id: 'skills', label: 'スキル', Component: Skills },
  { id: 'ledger', label: '분개장', Component: Ledger },
  { id: 'entries', label: '분개', Component: Entries },
  { id: 'opening', label: '시작 잔액', Component: Opening },
  { id: 'adjustment', label: '잔액 조정', Component: Adjustment },
  { id: 'subscriptions', label: '정기 지출', Component: Subscriptions },
  { id: 'balance', label: '잔액', Component: Balance },
  { id: 'credit', label: '카드', Component: CreditCard },
  { id: 'savings', label: '저축', Component: Savings },
  { id: 'monthly', label: '월차', Component: Monthly },
  { id: 'book', label: '원장', Component: LedgerBook },
]
