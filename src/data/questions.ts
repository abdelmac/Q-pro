import type { Trait } from './traits';

export interface RatingQuestion {
  id: string;
  text: string;
}

export interface RatingSection {
  id: string;
  title: string;
  subtitle: string;
  questions: RatingQuestion[];
}

export const RATING_SECTIONS: RatingSection[] = [
  {
    id: 'thinking',
    title: 'Thinking Style',
    subtitle: 'How your mind approaches problems and information.',
    questions: [
      { id: 'T1', text: 'You pay particular attention to "why" questions.' },
      { id: 'T2', text: 'You pay close attention to details.' },
      { id: 'T3', text: 'You prefer solving complex problems.' },
      { id: 'T4', text: 'You are able to concentrate for prolonged periods.' },
      { id: 'T5', text: 'You rely more on experience than on theory.' },
      { id: 'T6', text: 'You are satisfied with knowing "a little about many things".' },
      { id: 'T7', text: 'You feel uncomfortable when faced with vaguely defined problems.' },
      { id: 'T8', text: 'You think logically.' },
      { id: 'T9', text: 'You are objective.' },
      { id: 'T10', text: 'You have an aptitude for mathematics.' },
      { id: 'T11', text: 'You are visually oriented.' },
      { id: 'T12', text: 'You look for alternative possibilities.' },
    ],
  },
  {
    id: 'working',
    title: 'Working Style',
    subtitle: 'How you approach tasks, planning, and follow-through.',
    questions: [
      { id: 'W1', text: 'You get bored easily with repetitive activities.' },
      { id: 'W2', text: 'You enjoy doing research.' },
      { id: 'W3', text: 'You prefer a well-planned schedule.' },
      { id: 'W4', text: 'You are comfortable performing the same activity repeatedly.' },
      { id: 'W5', text: 'You easily accept interruptions to your schedule.' },
      { id: 'W6', text: 'You are willing to work toward long-term results.' },
      { id: 'W7', text: 'You are more of a thinker than a "doer".' },
      { id: 'W8', text: 'You are thorough and deliberate.' },
      { id: 'W9', text: 'You are persistent.' },
      { id: 'W10', text: 'You are more of a "doer" than a talker.' },
      { id: 'W11', text: 'You approach problems through direct, concrete action.' },
      { id: 'W12', text: 'You adapt easily to change.' },
      { id: 'W13', text: 'You tend to initiate activities.' },
    ],
  },
  {
    id: 'interpersonal',
    title: 'Interpersonal Skills',
    subtitle: 'How you relate to, communicate with, and lead people.',
    questions: [
      { id: 'I1', text: 'You are comfortable with short-term relationships with patients.' },
      { id: 'I2', text: 'You are a good team player.' },
      { id: 'I3', text: 'You feel energized by interacting with people.' },
      { id: 'I4', text: 'You are interested in people.' },
      { id: 'I5', text: 'You have good listening skills and enjoy listening to others.' },
      { id: 'I6', text: 'You communicate well.' },
      { id: 'I7', text: 'You have leadership qualities.' },
      { id: 'I8', text: 'You enjoy organizing people.' },
      { id: 'I9', text: 'You enjoy developing long-term relationships with people.' },
      { id: 'I10', text: "You find it difficult to say no to other people's requests." },
      { id: 'I11', text: 'You are warm and empathetic.' },
    ],
  },
  {
    id: 'motivations',
    title: 'Motivations',
    subtitle: 'What drives you in medicine and patient care.',
    questions: [
      { id: 'M1', text: 'You enjoy caring for people.' },
      { id: 'M2', text: 'You want to help people.' },
      { id: 'M3', text: 'You enjoy being an "expert" in your field.' },
      { id: 'M4', text: 'You feel a need to see the results of your efforts quickly.' },
      { id: 'M5', text: 'You want quick results.' },
      { id: 'M6', text: 'You enjoy being involved in your patients\' lives.' },
      { id: 'M7', text: 'You are achievement-oriented.' },
      { id: 'M8', text: 'You prefer treating curable conditions.' },
      { id: 'M9', text: 'You find satisfaction in achieving small improvements.' },
      { id: 'M10', text: 'You are interested in the basic sciences underlying medicine.' },
      { id: 'M11', text: 'You are studious.' },
      { id: 'M12', text: 'You seek the approval of others.' },
    ],
  },
  {
    id: 'personality',
    title: 'Personality',
    subtitle: 'Your temperament under pressure and in everyday life.',
    questions: [
      { id: 'P1', text: 'You feel a need to be in control of a situation.' },
      { id: 'P2', text: 'You are relaxed.' },
      { id: 'P3', text: 'You are sociable.' },
      { id: 'P4', text: 'You act decisively.' },
      { id: 'P5', text: 'You are adventurous or enjoy challenges.' },
      { id: 'P6', text: 'You are comfortable with uncertainty.' },
      { id: 'P7', text: 'You are energetic.' },
      { id: 'P8', text: 'You are serious and driven rather than laid-back.' },
      { id: 'P9', text: 'You are optimistic.' },
      { id: 'P10', text: 'You can handle failure gracefully.' },
      { id: 'P11', text: 'You are self-confident.' },
      { id: 'P12', text: 'You are a perfectionist.' },
      { id: 'P13', text: 'You remain calm in a crisis.' },
    ],
  },
  {
    id: 'skills',
    title: 'Special Skills and Interests',
    subtitle: 'Your aptitudes and hands-on or technical interests.',
    questions: [
      { id: 'S1', text: 'You have good manual dexterity.' },
      { id: 'S2', text: 'You have good observational skills.' },
      { id: 'S3', text: 'You are able to perform multiple activities simultaneously.' },
      { id: 'S4', text: 'You can coordinate different tasks.' },
      { id: 'S5', text: 'You enjoy coordinating the care of patients and their families.' },
      { id: 'S6', text: 'You are a good coordinator.' },
      { id: 'S7', text: 'You enjoy gadgets and technology.' },
      { id: 'S8', text: 'You have mechanical aptitude.' },
      { id: 'S9', text: 'You enjoy teaching.' },
    ],
  },
  {
    id: 'values',
    title: 'Values and Lifestyle',
    subtitle: 'What matters to you outside and around the work itself.',
    questions: [
      { id: 'V1', text: 'You value having free time.' },
      { id: 'V2', text: 'You value independence.' },
      { id: 'V3', text: 'You have interests outside medicine.' },
      { id: 'V4', text: 'You want to deal with all aspects of medicine.' },
      { id: 'V5', text: 'You are willing to work long hours.' },
      { id: 'V6', text: 'You value organization.' },
      { id: 'V7', text: 'You want a good income.' },
      { id: 'V8', text: 'You identify with professional role models.' },
      { id: 'V9', text: 'You are comfortable with your own mortality.' },
      { id: 'V10', text: 'You are tolerant of others.' },
      { id: 'V11', text: 'You value harmony.' },
    ],
  },
];

export const ALL_QUESTION_IDS: string[] = RATING_SECTIONS.flatMap((s) => s.questions.map((q) => q.id));

export type { Trait };
