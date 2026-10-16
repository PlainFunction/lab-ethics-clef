/**
 * The ethical theories we test each action against. Each one becomes a yes/no
 * ("noul") question for Clef-flash, so `test` is the one-sentence check that
 * theory applies. Kept short: Workers AI truncates long text input.
 */
export interface Theory {
  id: string
  name: string
  test: string
  /** False for theories we show but leave out of the overall verdict. */
  inVerdict: boolean
}

export const THEORIES: Theory[] = [
  {
    id: 'utilitarian',
    name: 'Utilitarianism',
    test: 'Does the action produce more overall wellbeing than harm, counting everyone affected equally?',
    inVerdict: true,
  },
  {
    id: 'kantian',
    name: 'Kantian deontology',
    test: 'Could the reason behind the action be a rule everyone follows, and does it treat people as ends, never merely as a means?',
    inVerdict: true,
  },
  {
    id: 'ross',
    name: 'Ross\'s prima facie duties',
    test: 'Weighing duties of honesty, keeping promises, justice, gratitude, avoiding harm and doing good, do the duties that support the action outweigh those against it?',
    inVerdict: true,
  },
  {
    id: 'virtue',
    name: 'Virtue ethics',
    test: 'Is this what an honest, fair, brave and kind person would do in the same situation?',
    inVerdict: true,
  },
  {
    id: 'care',
    name: 'Ethics of care',
    test: 'Does the action look after the relationships involved and respond to the needs of the people who depend on the person acting?',
    inVerdict: true,
  },
  {
    id: 'contractualist',
    name: 'Contractualism',
    test: 'Is the action allowed by principles that nobody affected could reasonably reject?',
    inVerdict: true,
  },
  {
    id: 'rights',
    name: 'Rights-based ethics',
    test: 'Does the action respect everyone\'s rights, including life, liberty, property, privacy and consent?',
    inVerdict: true,
  },
  {
    id: 'natural_law',
    name: 'Natural law',
    test: 'Does the action fit basic human goods such as life, knowledge, friendship and fairness, without deliberately acting against any of them?',
    inVerdict: true,
  },
  {
    id: 'egoist',
    name: 'Ethical egoism',
    test: 'Does the action serve the long-term interests of the person doing it?',
    // Egoism asks "is it good for me?", not "is it right?". Giving to charity
    // fails it, so counting it would mark almost every kind act as contested.
    inVerdict: false,
  },
]

/** What a theory mostly cares about. Used for the "main concern" choice question. */
export const CONCERNS: Record<string, string> = {
  harm: 'Who is helped or hurt, and by how much',
  duty: 'Rules, promises and honesty',
  character: 'What the action says about the person doing it',
  relationships: 'The people who depend on each other',
  fairness: 'Whether those affected would agree to it',
  rights: 'Consent, privacy, property or liberty',
  self_interest: 'What the person acting gains or loses',
}
