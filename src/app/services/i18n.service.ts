import { Injectable, signal } from '@angular/core';

export type Language = 'en' | 'bg';

interface TranslationMap {
  [key: string]: string | TranslationMap;
}

const STORAGE_KEY = 'app-language';

const translations: Record<Language, TranslationMap> = {
  en: {
    common: {
      language: 'Language',
      english: 'English',
      bulgarian: 'Bulgarian',
      logout: 'Log out',
      unauthorized: 'Access restricted',
      noPermission: 'You do not have permission to access the administrative areas yet.',
      notFound: 'The page you are trying to access could not be found.',
      backToDashboard: 'Back to dashboard',
    },
    nav: {
      dashboard: 'Dashboard',
      manage: 'Manage',
      plans: 'Plans',
      gyms: 'Gyms',
      gymSubscriptions: 'Gym subscriptions',
      trainers: 'Trainers',
      trainingTimes: 'Training times',
      trainees: 'Trainees',
      attendance: 'Attendance',
      settlements: 'Settlements',
      toggleNavigation: 'Toggle navigation',
    },
    login: {
      welcomeBack: 'Welcome back',
      signInToAccess: 'Sign in to access TheIndex.',
      highlights1: 'Trainers to manage trainings',
      highlights2: 'Trainees to track their personal progress',
      signIn: 'Sign in',
      credentialsInfo: 'Use your The Index account credentials to continue.',
      email: 'Email',
      emailPlaceholder: 'you@company.com',
      password: 'Password',
      emailRequired: 'Email is required.',
      passwordRequired: 'Password is required.',
      passwordLength: 'Password must be at least 3 characters.',
      signInError: 'Unable to sign in with those credentials.',
      needAccess: 'Need access? Contact admin',
    },
    home: {
      dashboard: 'Dashboard',
      welcome: 'Welcome back! Shortcuts and key metrics will appear here.',
      quickLinks: 'Quick links',
      registerAttendance: 'Register attendance',
      listOfTrainings: 'List of trainings',
      settlementReports: 'Settlement reports',
      quickActions: 'Quick actions',
      quickActionsText: 'Add plans, gyms, trainers, or trainees from the navigation.',
      upcomingWork: 'Upcoming work',
      upcomingWorkText: 'Attendance and settlement reports will surface here soon.',
      subscriptions: 'Subscriptions',
      subscriptionsText: 'Subscription insights will live on this dashboard.',
    },
  },
  bg: {
    common: {
      language: 'Език',
      english: 'Английски',
      bulgarian: 'Български',
      logout: 'Изход',
      unauthorized: 'Ограничен достъп',
      noPermission: 'Нямате права за достъп до административните секции.',
      notFound: 'Страницата, която търсите, не беше намерена.',
      backToDashboard: 'Към таблото',
    },
    nav: {
      dashboard: 'Табло',
      manage: 'Управление',
      plans: 'Планове',
      gyms: 'Зали',
      gymSubscriptions: 'Абонаменти за зали',
      trainers: 'Треньори',
      trainingTimes: 'Тренировки',
      trainees: 'Трениращи',
      attendance: 'Посещения',
      settlements: 'Разчети',
      toggleNavigation: 'Превключи навигацията',
    },
    login: {
      welcomeBack: 'Добре дошли отново',
      signInToAccess: 'Влезте, за да използвате TheIndex.',
      highlights1: 'Треньори за управление на тренировките',
      highlights2: 'Трениращи за проследяване на личния прогрес',
      signIn: 'Вход',
      credentialsInfo: 'Използвайте данните на вашия The Index профил, за да продължите.',
      email: 'Имейл',
      emailPlaceholder: 'you@company.com',
      password: 'Парола',
      emailRequired: 'Имейлът е задължителен.',
      passwordRequired: 'Паролата е задължителна.',
      passwordLength: 'Паролата трябва да е поне 3 символа.',
      signInError: 'Неуспешен вход с тези данни.',
      needAccess: 'Нуждаете се от достъп? Свържете се с администратор',
    },
    home: {
      dashboard: 'Табло',
      welcome: 'Добре дошли! Тук ще виждате преки пътища и ключови показатели.',
      quickLinks: 'Бързи връзки',
      registerAttendance: 'Регистрирай посещение',
      listOfTrainings: 'Списък с тренировки',
      settlementReports: 'Справки за разчети',
      quickActions: 'Бързи действия',
      quickActionsText: 'Добавяйте планове, зали, треньори или трениращи от менюто.',
      upcomingWork: 'Предстояща работа',
      upcomingWorkText: 'Тук скоро ще се показват посещения и отчети за разчети.',
      subscriptions: 'Абонаменти',
      subscriptionsText: 'Тук ще се показват анализи за абонаментите.',
    },
  },
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly language = signal<Language>(this.getInitialLanguage());

  setLanguage(language: Language): void {
    this.language.set(language);
    localStorage.setItem(STORAGE_KEY, language);
  }

  translate(key: string): string {
    const selected = this.resolveKey(translations[this.language()], key);
    if (typeof selected === 'string') {
      return selected;
    }

    const fallback = this.resolveKey(translations.en, key);
    return typeof fallback === 'string' ? fallback : key;
  }

  private getInitialLanguage(): Language {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'bg') {
      return stored;
    }

    const browserLanguage = navigator.language.toLowerCase();
    return browserLanguage.startsWith('bg') ? 'bg' : 'en';
  }

  private resolveKey(map: TranslationMap, key: string): string | TranslationMap | undefined {
    return key.split('.').reduce<string | TranslationMap | undefined>((current, part) => {
      if (!current || typeof current === 'string') {
        return undefined;
      }
      return current[part];
    }, map);
  }
}
