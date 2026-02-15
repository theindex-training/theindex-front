import { Injectable, effect } from '@angular/core';
import { I18nService } from './i18n.service';

const PHRASE_TRANSLATIONS: Record<string, string> = {
  Actions: 'Действия',
  Active: 'Активен',
  Inactive: 'Неактивен',
  Name: 'Име',
  Status: 'Статус',
  Notes: 'Бележки',
  Details: 'Детайли',
  Account: 'Акаунт',
  Email: 'Имейл',
  Phone: 'Телефон',
  Address: 'Адрес',
  Nickname: 'Псевдоним',
  Plan: 'План',
  Gym: 'Зала',
  Trainer: 'Треньор',
  Trainee: 'Трениращ',
  Attendance: 'Посещения',
  Settlements: 'Разчети',
  Subscriptions: 'Абонаменти',
  Password: 'Парола',
  'Loading...': 'Зареждане...',
  Apply: 'Приложи',
  Default: 'По подразбиране',
  'Not specified': 'Не е посочено',
  'Open details': 'Отвори детайли',
  'Open report': 'Отвори отчет',
  'Generate report': 'Генерирай отчет',
  'Create plan': 'Създай план',
  'Edit plan': 'Редактирай план',
  'Deactivate plan': 'Деактивирай план',
  'Plan details': 'Детайли за план',
  'New plan': 'Нов план',
  'Back to plans': 'Назад към планове',
  Plans: 'Планове',
  Gyms: 'Зали',
  'Create gym': 'Създай зала',
  'Edit gym': 'Редактирай зала',
  'Deactivate gym': 'Деактивирай зала',
  'Gym details': 'Детайли за зала',
  'New gym': 'Нова зала',
  'Back to gyms': 'Назад към зали',
  'Gym subscriptions': 'Абонаменти за зали',
  'Create gym subscription': 'Създай абонамент за зала',
  'Edit gym subscription': 'Редактирай абонамент за зала',
  'Deactivate gym subscription': 'Деактивирай абонамент за зала',
  'Gym subscription details': 'Детайли за абонамент за зала',
  'New gym subscription': 'Нов абонамент за зала',
  'Back to gym subscriptions': 'Назад към абонаменти за зали',
  Trainers: 'Треньори',
  'Create trainer': 'Създай треньор',
  'Edit trainer': 'Редактирай треньор',
  'Deactivate trainer': 'Деактивирай треньор',
  'Trainer details': 'Детайли за треньор',
  'Trainer account': 'Акаунт на треньор',
  'New trainer': 'Нов треньор',
  'Back to trainers': 'Назад към треньори',
  Trainees: 'Трениращи',
  'Create trainee': 'Създай трениращ',
  'Edit trainee': 'Редактирай трениращ',
  'Deactivate trainee': 'Деактивирай трениращ',
  'Trainee details': 'Детайли за трениращ',
  'Trainee account': 'Акаунт на трениращ',
  'New trainee': 'Нов трениращ',
  'Back to trainees': 'Назад към трениращи',
  'Training times': 'Тренировки',
  'Create training time': 'Създай тренировъчен час',
  'Edit training time': 'Редактирай тренировъчен час',
  'Delete training time': 'Изтрий тренировъчен час',
  'Training time details': 'Детайли за тренировъчен час',
  'New training time': 'Нов тренировъчен час',
  'Back to training times': 'Назад към тренировки',
  'Attendance sessions': 'Сесии посещения',
  'Register attendance': 'Регистрирай посещение',
  'Back to attendance': 'Назад към посещения',
  'Generate settlement report': 'Генерирай отчет за разчети',
  'Back to settlements': 'Назад към разчети',
  'Create a new settlement using period start and period end dates.':
    'Създайте нов разчет чрез начална и крайна дата на периода.',
  'Manage training plans, pricing, and availability.':
    'Управлявайте тренировъчни планове, цени и наличност.',
  'Manage trainer profiles and credentials.':
    'Управлявайте профили и достъп на треньори.',
  'Manage trainee profiles and credentials.':
    'Управлявайте профили и достъп на трениращи.',
  'Add a new gym location.': 'Добавете нова зала.',
  'Add a new gym subscription method.': 'Добавете нов метод за абонамент за зала.',
  'Add a new trainee profile and optional account link.':
    'Добавете нов профил на трениращ и опционална връзка с акаунт.',
  'Add a new trainer profile and optional account link.':
    'Добавете нов профил на треньор и опционална връзка с акаунт.',
  'Define the pricing and duration for a new training plan.':
    'Определете цена и продължителност за нов тренировъчен план.',
  'Define time slots that can be used when registering attendance.':
    'Определете часови слотове за регистрация на посещения.',
  'Capture a completed training session and mark all trainees who attended.':
    'Отбележете проведена тренировка и всички присъствали трениращи.',
  'Update gym subscription details.': 'Обновете детайлите на абонамента за зала.',
  'Gym subscriptions are archived by marking them inactive.':
    'Абонаментите за зали се архивират чрез маркиране като неактивни.',
  'Gyms are archived by marking them inactive.': 'Залите се архивират чрез маркиране като неактивни.',
  'Deactivating a gym hides it from new schedules, but existing references remain unchanged.':
    'Деактивирането на залата я скрива от нови графици, но текущите връзки остават.',
  'Deactivating a gym subscription hides it from new trainee assignments.':
    'Деактивирането на абонамент за зала го скрива от нови назначения на трениращи.',
  'Deactivating a plan hides it from new sign-ups, but existing subscriptions remain unchanged.':
    'Деактивирането на плана го скрива от нови записвания, но текущите абонаменти остават.',
  'Disable access for a trainee while keeping their profile.':
    'Спрете достъпа на трениращ, като запазите профила му.',
  'Disable access for a trainer while keeping their profile.':
    'Спрете достъпа на треньор, като запазите профила му.',
  'Inspect settlement totals and allocation rows for this report.':
    'Прегледайте общите суми и редовете за разпределение в този отчет.',
  'No plans found yet.': 'Все още няма планове.',
  'No gyms found yet.': 'Все още няма зали.',
  'No gym subscriptions found yet.': 'Все още няма абонаменти за зали.',
  'No trainees found yet.': 'Все още няма трениращи.',
  'No trainers found yet.': 'Все още няма треньори.',
  'No training times found yet.': 'Все още няма тренировъчни часове.',
  'No settlements available yet.': 'Все още няма налични разчети.',
  'No subscriptions yet.': 'Все още няма абонаменти.',
  'No allocations to display.': 'Няма разпределения за показване.',
  'No trainer totals found for this settlement.': 'Няма общи суми за треньори за този разчет.',
  'No trainees match this search.': 'Няма трениращи, които отговарят на търсенето.',
  'No attendance sessions found for the selected filters.':
    'Няма намерени сесии посещения за избраните филтри.',
  'Loading plans...': 'Зареждане на планове...',
  'Loading gyms...': 'Зареждане на зали...',
  'Loading gym...': 'Зареждане на зала...',
  'Loading gym subscription...': 'Зареждане на абонамент за зала...',
  'Loading gym subscriptions...': 'Зареждане на абонаменти за зали...',
  'Loading trainees...': 'Зареждане на трениращи...',
  'Loading trainee...': 'Зареждане на трениращ...',
  'Loading trainers...': 'Зареждане на треньори...',
  'Loading trainer...': 'Зареждане на треньор...',
  'Loading subscriptions...': 'Зареждане на абонаменти...',
  'Loading settlements...': 'Зареждане на разчети...',
  'Loading settlement...': 'Зареждане на разчет...',
  'Loading attendance sessions...': 'Зареждане на сесии посещения...',
  'Loading training times...': 'Зареждане на тренировъчни часове...',
  'Loading training time...': 'Зареждане на тренировъчен час...',
  'Loading trainers, gyms, and trainees...': 'Зареждане на треньори, зали и трениращи...',
  'Loading allocations...': 'Зареждане на разпределения...',
  'Name is required and must be at least 2 characters.':
    'Името е задължително и трябва да е поне 2 символа.',
  'Name is required and must be between 2 and 120 characters.':
    'Името е задължително и трябва да е между 2 и 120 символа.',
  'Phone must be at least 1 character.': 'Телефонът трябва да е поне 1 символ.',
  'Nickname must be at least 1 character.': 'Псевдонимът трябва да е поне 1 символ.',
  'Credits must be at least 1.': 'Кредитите трябва да са поне 1.',
  'Duration must be at least 1 day.': 'Продължителността трябва да е поне 1 ден.',
  'Gym location is required.': 'Залата е задължителна.',
  'End time is required.': 'Крайният час е задължителен.',
  'Enter a valid amount.': 'Въведете валидна сума.',
  'Enter a valid email address.': 'Въведете валиден имейл адрес.',
  'Enter a valid price (up to two decimals).': 'Въведете валидна цена (до два знака след десетичната запетая).',
  'Password fields must contain at least 8 characters.': 'Паролите трябва да са поне 8 символа.',
  'Passwords do not match.': 'Паролите не съвпадат.',
  'Deleting cannot be undone.': 'Изтриването не може да бъде отменено.',
  'Clear filtered': 'Изчисти филтрирането',
  'All trainers': 'Всички треньори',
  'No gym subscription': 'Няма абонамент за зала',
  'Attendance count': 'Брой посещения',
  'Generated at': 'Генерирано на',
  'Period start': 'Начало на период',
  'Period end': 'Край на период',
  'Start date': 'Начална дата',
  'End date': 'Крайна дата',
  'Start time': 'Начален час',
  'End time': 'Краен час',
  'Paid amount (EUR)': 'Платена сума (EUR)',
  Credits: 'Кредити',
  'Duration (days)': 'Продължителност (дни)',
  Title: 'Заглавие',
  'Gym location': 'Зала',
  'Linked account': 'Свързан акаунт',
  'Account information': 'Информация за акаунт',
  'Choose a start date.': 'Изберете начална дата.',
  '12 trainings': '12 тренировки',
  '30 min': '30 мин',
  '45 min': '45 мин',
  '60 min': '60 мин',
  '90 min': '90 мин',
  '120 min': '120 мин',
};

@Injectable({ providedIn: 'root' })
export class UiTranslationService {
  private readonly originalText = new WeakMap<Text, string>();
  private readonly originalAttributes = new WeakMap<Element, Map<string, string>>();
  private observer?: MutationObserver;

  constructor(private readonly i18nService: I18nService) {
    if (typeof document === 'undefined') {
      return;
    }

    effect(() => {
      const lang = this.i18nService.language();
      queueMicrotask(() => this.translateTree(document.body, lang));
    });

    this.observer = new MutationObserver((mutations) => {
      const lang = this.i18nService.language();
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => this.translateNode(node, lang));
        if (mutation.type === 'characterData' && mutation.target) {
          this.translateNode(mutation.target, lang);
        }
      }
    });

    this.observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  }

  private translateTree(root: ParentNode, lang: 'en' | 'bg'): void {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL);
    let node: Node | null = walker.currentNode;
    while (node) {
      this.translateNode(node, lang);
      node = walker.nextNode();
    }
  }

  private translateNode(node: Node, lang: 'en' | 'bg'): void {
    if (node.nodeType === Node.TEXT_NODE) {
      this.translateTextNode(node as Text, lang);
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      this.translateAttributes(node as Element, lang);
    }
  }

  private translateTextNode(node: Text, lang: 'en' | 'bg'): void {
    const parentTag = node.parentElement?.tagName;
    if (!parentTag || parentTag === 'SCRIPT' || parentTag === 'STYLE') {
      return;
    }

    if (!this.originalText.has(node)) {
      this.originalText.set(node, node.nodeValue ?? '');
    }

    const original = this.originalText.get(node) ?? '';
    node.nodeValue = lang === 'bg' ? this.translateString(original) : original;
  }

  private translateAttributes(element: Element, lang: 'en' | 'bg'): void {
    const translatableAttributes = ['placeholder', 'title', 'aria-label'];

    let stored = this.originalAttributes.get(element);
    if (!stored) {
      stored = new Map<string, string>();
      this.originalAttributes.set(element, stored);
    }

    for (const attr of translatableAttributes) {
      const current = element.getAttribute(attr);
      if (current == null) {
        continue;
      }

      if (!stored.has(attr)) {
        stored.set(attr, current);
      }

      const original = stored.get(attr) ?? current;
      element.setAttribute(attr, lang === 'bg' ? this.translateString(original) : original);
    }
  }

  private translateString(input: string): string {
    const leading = input.match(/^\s*/)?.[0] ?? '';
    const trailing = input.match(/\s*$/)?.[0] ?? '';
    const core = input.trim();

    if (!core) {
      return input;
    }

    if (PHRASE_TRANSLATIONS[core]) {
      return `${leading}${PHRASE_TRANSLATIONS[core]}${trailing}`;
    }

    let translated = core;
    for (const [en, bg] of Object.entries(PHRASE_TRANSLATIONS).sort((a, b) => b[0].length - a[0].length)) {
      translated = translated.replaceAll(en, bg);
    }

    return `${leading}${translated}${trailing}`;
  }
}
