# Data Schema — MultiCallculator

## 1. Назначение

MultiCallculator — статическое веб-приложение для предварительной оценки стоимости и срока клининговых работ. Приложение содержит три независимых калькулятора:

1. работы после пожара;
2. абразивоструйная очистка металла;
3. абразивоструйная очистка кирпичного фасада.

Бэкенда и серверной базы данных нет. Введённые значения хранятся в DOM текущего `iframe`, результаты вычисляются в браузере. Только сохранённые расчёты фасада записываются в `localStorage`.

## 2. Общая модель данных

```text
MultiCallculator
├── FireCalculation
├── MetalCalculation
└── FacadeCalculation
    └── SavedFacadeCalculation[] → localStorage["facadeCalcs"]
```

Каждый расчёт состоит из:

- `input` — данные, введённые менеджером;
- `result` — вычисляемые значения;
- `clientText` — готовый текст предварительной оценки для клиента.

Денежные значения в модели хранятся как числа в рублях. Площади — в м², продолжительность — в рабочих днях, коэффициенты — положительные десятичные числа.

## 3. Расчёт после пожара

### FireCalculationInput

| Поле | Тип | Обязательное | Значение по умолчанию | Описание |
|---|---|---:|---:|---|
| `area` | number | да | 1000 | Площадь по полу, м² |
| `baseRate` | number | да | 4000 | Базовая ставка, ₽/м² |
| `heightCoef` | number | да | из выбранной опции | Коэффициент высоты |
| `clientCoef` | number | да | из выбранной опции | Сложность заказчика и контроля |
| `finishCoef` | number | да | из выбранной опции | Деликатность отделки |
| `accessCoef` | number | да | из выбранной опции | Доступ и скрытые риски |
| `urgencyCoef` | number | да | из выбранной опции | Срочность |
| `nightCoef` | number | да | из выбранной опции | Режим работ |
| `demArea` | number | нет | 0 | Площадь демонтажа, м² |
| `demRate` | number | нет | 900 | Ставка демонтажа, ₽/м² |
| `waste` | number | нет | 0 | Вывоз и контейнеры, ₽ |
| `stairsArea` | number | нет | 0 | Площадь лестниц по проекции, м² |
| `stairsMult` | number | нет | из выбранной опции | Коэффициент сложности лестниц |
| `stairsRate` | number | нет | 4000 | Ставка лестниц, ₽/м² |
| `voidArea` | number | нет | 0 | Площадь скрытых полостей, м² |
| `voidRate` | number | нет | 1800 | Ставка полостей, ₽/м² |
| `hatches` | number | нет | 0 | Количество лючков, шт. |
| `hatchRate` | number | нет | 700 | Ставка за лючок, ₽/шт. |
| `reserve` | number | да | 10 | Резерв, % |
| `prodNorm` | number | да | 8 | Норма, м²/чел.-день |
| `manDayCost` | number | да | 5500 | Стоимость чел.-дня, ₽ |
| `crew` | integer | да | 8 | Численность бригады |
| `extraCostPct` | number | да | 30 | Дополнительные расходы к труду, % |
| `comment` | string | нет | заданный текст | Комментарий для клиента |

### FireCalculationResult

| Поле | Тип | Описание |
|---|---|---|
| `fullCoef` | number | Произведение шести коэффициентов сложности |
| `commercialCoef` | number | `1 + (fullCoef - 1) × 0.35` |
| `baseWorks` | number | `area × baseRate × commercialCoef` |
| `demWorks` | number | `demArea × demRate + waste` |
| `stairsWorks` | number | `stairsArea × stairsMult × stairsRate` |
| `voidWorks` | number | `voidArea × voidRate + hatches × hatchRate` |
| `subtotal` | number | Сумма основных и дополнительных работ |
| `reserveAmount` | number | `subtotal × reserve / 100` |
| `total` | number | `subtotal + reserveAmount` |
| `effectiveRate` | number | `total / area` |
| `manDays` | number | Требуемые человеко-дни |
| `days` | number | `manDays / crew` |
| `productionCost` | number | Расчётная себестоимость труда |
| `grossMargin` | number | `total - productionCost` |
| `grossMarginPct` | number | Валовая маржа, % |
| `warning` | string | Подсказка менеджеру по эффективной ставке |
| `clientText` | string | Текст предварительной оценки для клиента |

## 4. Расчёт очистки металла

### MetalCalculationInput

| Поле | Тип | Обязательное | По умолчанию | Описание |
|---|---|---:|---:|---|
| `area` | number | да | 500 | Площадь металла, м² |
| `posts` | integer | да | 1 | Количество постов |
| `geometry` | number | да | из выбранной опции | Коэффициент геометрии |
| `condition` | number | да | из выбранной опции | Коэффициент состояния поверхности |
| `standard` | number | да | из выбранной опции | Коэффициент степени очистки |
| `access` | number | да | из выбранной опции | Коэффициент доступа и условий |
| `baseProduction` | number | да | 90 | Выработка одного поста, м²/смена |
| `basePrice` | number | да | 750 | Базовая цена, ₽/м² |
| `risk` | number | да | 20 | Минимальная маржа/риск, % |
| `shiftsPerDay` | number | да | 1 | Количество смен в день |
| `comment` | string | нет | заданный текст | Комментарий для клиента |

### MetalCalculationResult

| Поле | Тип | Описание |
|---|---|---|
| `coef` | number | `geometry × condition × standard × access` |
| `prodOne` | number | Выработка одного поста: не менее 15 м²/смена |
| `prodAll` | number | `prodOne × posts` |
| `shifts` | number | `area / prodAll` |
| `days` | number | `shifts / shiftsPerDay` |
| `priceMid` | number | `basePrice × coef × (1 + risk / 100)` |
| `priceMin` | number | `priceMid × 0.9` |
| `priceMax` | number | `priceMid × 1.12` |
| `totalMin` | number | `priceMin × area` |
| `totalMax` | number | `priceMax × area` |
| `warning` | string | Предупреждение при высоком коэффициенте |
| `clientText` | string | Текст предварительной оценки для клиента |

## 5. Расчёт кирпичного фасада

### FacadeCalculationInput

| Поле | Тип | Обязательное | По умолчанию | Описание |
|---|---|---:|---:|---|
| `area` | number | да | 500 | Площадь фасада, м² |
| `baseRate` | number | да | 300 | Базовая ставка пескоструя, ₽/м² |
| `heightCoef` | number | да | из выбранной опции | Высота/этажность |
| `brickCoef` | number | да | из выбранной опции | Тип кирпича |
| `dirtCoef` | number | да | из выбранной опции | Степень загрязнения |
| `accessCoef` | number | да | из выбранной опции | Доступ |
| `segmentCoef` | number | да | из выбранной опции | Сегмент объекта |
| `clientCoef` | number | да | из выбранной опции | Требования заказчика |
| `quietCoef` | number | да | из выбранной опции | Ограничение по тихим часам |
| `cleanCoef` | number | да | из выбранной опции | Ежедневная уборка абразива |
| `coverCoef` | number | да | из выбранной опции | Требования к укрывке |
| `netCoef` | number | да | из выбранной опции | Защитная сетка/укрытие |
| `spaceCoef` | number | да | из выбранной опции | Место для подъёмной техники |
| `reinfOn` | boolean | да | false | Включён ли укрепляющий состав |
| `reinfArea` | number | условно | 0 | Площадь укрепления, м² |
| `reinfRate` | number | условно | 150 | Ставка укрепления, ₽/м² |
| `hydroOn` | boolean | да | false | Включена ли гидрофобизация |
| `hydroArea` | number | условно | 0 | Площадь гидрофобизации, м² |
| `hydroRate` | number | условно | 100 | Ставка за слой, ₽/м² |
| `hydroLayers` | integer | условно | 1 | Количество слоёв |
| `jointOn` | boolean | да | false | Включено ли восстановление швов |
| `jointArea` | number | условно | 0 | Площадь швов, м² |
| `jointRate` | number | условно | 400 | Ставка швов, ₽/м² |
| `reserve` | number | да | 10 | Резерв, % |
| `prodNorm` | number | да | 40 | Норма, м²/чел.-день |
| `crew` | integer | да | 4 | Численность бригады |
| `comment` | string | нет | заданный текст | Комментарий для клиента |

Условные поля участвуют в расчёте только при значении `true` у соответствующего переключателя `*On`.

### FacadeCalculationResult

| Поле | Тип | Описание |
|---|---|---|
| `fullCoef` | number | Произведение 11 коэффициентов |
| `baseWorks` | number | `area × baseRate × fullCoef` |
| `reinfWorks` | number | `reinfArea × reinfRate`, если блок включён |
| `hydroWorks` | number | `hydroArea × hydroRate × hydroLayers`, если блок включён |
| `jointWorks` | number | `jointArea × jointRate`, если блок включён |
| `subtotal` | number | Сумма всех включённых работ |
| `reserveAmount` | number | `subtotal × reserve / 100` |
| `total` | number | `subtotal + reserveAmount` |
| `effectiveRate` | number | `total / area` |
| `manDays` | number | `area / prodNorm` |
| `days` | number | `manDays / crew` |
| `warning` | string | Подсказка менеджеру по ставке |
| `clientText` | string | Текст предварительной оценки для клиента |

## 6. Сохраняемый расчёт фасада

Ключ хранилища: `facadeCalcs`.

Значение: JSON-массив объектов `SavedFacadeCalculation`. Новая запись добавляется в начало массива.

| Поле | Тип | Обязательное | Описание |
|---|---|---:|---|
| `t` | string | да | Локальные дата и время сохранения |
| `area` | number | да | Площадь фасада, м² |
| `total` | string | да | Отформатированная итоговая сумма, например `"415 800 ₽"` |
| `rate` | string | да | Отформатированная эффективная ставка |
| `text` | string | да | Полный текст для клиента |

Пример:

```json
[
  {
    "t": "19.07.2026, 14:30:00",
    "area": 500,
    "total": "415 800 ₽",
    "rate": "Эффективно: 832 ₽/м²",
    "text": "Предварительная оценка работ по кирпичному фасаду..."
  }
]
```

Чтение и запись `localStorage` выполняются через `try/catch`. При повреждённом или недоступном хранилище приложение использует пустой массив.

## 7. Валидация и ограничения

- `area`, ставки, нормы, проценты и объёмы — числа не меньше 0.
- Основная площадь, количество постов, количество смен, норма выработки и размер бригады должны быть больше 0.
- `posts`, `crew`, `hatches` и `hydroLayers` — целые числа.
- Все коэффициенты должны быть больше 0 и браться из разрешённых значений `<select>`.
- Если основная площадь равна 0, эффективная ставка возвращается как 0; интерфейс не должен показывать `NaN` или `Infinity`.
- Поля опционального фасадного блока игнорируются, пока соответствующий переключатель выключен.
- Округление применяется только при отображении; вычисления выполняются с исходными числовыми значениями.
- Форматирование валюты выполняется для локали `ru-RU`.
- Данные разных калькуляторов изолированы внутри отдельных `iframe`.

## 8. Текущие ограничения хранения

- Расчёты пожара и металла не сохраняются.
- Расчёты фасада доступны только в том же браузере и на том же устройстве.
- Пользователи, авторизация, серверная синхронизация и общая база объектов отсутствуют.
- Удаление сохранённого расчёта фасада физически удаляет элемент из массива `facadeCalcs`.
