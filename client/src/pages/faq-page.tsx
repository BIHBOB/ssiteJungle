import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MessageCircle, Truck, CreditCard, Share, Leaf } from "lucide-react";

export default function FaqPage() {
  const [activeTab, setActiveTab] = useState("general");

  const generalFaqs = [
    {
      question: "Как происходит доставка растений?",
      answer: (
        <>
          <p className="mb-3">
            Доставка осуществляется через CDEK или Почту России, на выбор. Все растения тщательно упаковываются с использованием специальных материалов, чтобы избежать повреждений.
          </p>
          <p>
            При необходимости, особенно в холодное время года, мы используем утепление для защиты растений от низких температур.
          </p>
        </>
      ),
    },
    {
      question: "Как оплатить заказ?",
      answer: (
        <>
          <p>У нас доступны два способа оплаты:</p>
          <ul className="list-disc pl-5 my-3">
            <li>Через YooMoney (онлайн-оплата картой)</li>
            <li>Прямым переводом по реквизитам (с подтверждением платежа)</li>
          </ul>
          <p>После оформления заказа вы сможете выбрать подходящий способ оплаты.</p>
        </>
      ),
    },
    {
      question: "Что делать, если растение пришло поврежденным?",
      answer: (
        <>
          <p>Если вы получили поврежденное растение, пожалуйста, следуйте этим шагам:</p>
          <ol className="list-decimal pl-5 my-3">
            <li>Сфотографируйте растение и упаковку сразу после получения</li>
            <li>Свяжитесь с нами через личный кабинет или напрямую в Telegram (@helen_heinlein)</li>
            <li>Предоставьте фотографии и номер заказа</li>
          </ol>
          <p>Мы рассмотрим ваше обращение в течение 24 часов и предложим решение проблемы.</p>
        </>
      ),
    },
    {
      question: "Как работают предзаказы и список ожидания?",
      answer: (
        <>
          <p className="mb-3">
            Для редких растений мы предлагаем систему предзаказов. Когда растения станут доступны, вы получите уведомление.
          </p>
          <p className="mb-3">
            Лист ожидания работает для товаров с ограниченным количеством. Когда товар закончился, вы можете подписаться на уведомления и получить информацию, когда он снова появится в наличии.
          </p>
        </>
      ),
    },
  ];

  const deliveryFaqs = [
    {
      question: "Какие способы доставки вы предлагаете?",
      answer: (
        <>
          <p className="mb-3">Мы осуществляем доставку растений двумя способами:</p>
          <ul className="list-disc pl-5 mb-3">
            <li><strong>CDEK</strong> - надежная курьерская доставка с возможностью отслеживания</li>
            <li><strong>Почта России</strong> - доставка в любую точку страны</li>
          </ul>
          <p>Для обоих способов доставки вы можете выбрать стандартную или экспресс-доставку (с наценкой 20%).</p>
        </>
      ),
    },
    {
      question: "Сколько стоит доставка?",
      answer: (
        <>
          <p className="mb-3">Стоимость доставки зависит от:</p>
          <ul className="list-disc pl-5 mb-3">
            <li>Выбранного способа доставки (CDEK или Почта России)</li>
            <li>Скорости доставки (стандартная или экспресс)</li>
            <li>Региона доставки</li>
            <li>Размера и веса растений</li>
          </ul>
          <p className="mb-3">Базовая стоимость доставки начинается от 300 рублей.</p>
          <p>При оформлении заказа с несколькими растениями мы берем максимальную стоимость доставки из всех растений в заказе, а не сумму за каждое.</p>
        </>
      ),
    },
    {
      question: "Как происходит доставка растений в холодное время года?",
      answer: (
        <>
          <p className="mb-3">В холодное время года (при температуре ниже +5°C) мы предлагаем следующие варианты:</p>
          <ul className="list-disc pl-5 mb-3">
            <li><strong>Утепление посылки</strong> - специальная упаковка с теплоизоляцией для защиты от низких температур</li>
            <li><strong>Передержка растений до весны</strong> - мы можем сохранить ваши растения у себя до наступления тепла</li>
          </ul>
          <p>При оформлении заказа вы можете выбрать эти дополнительные опции.</p>
        </>
      ),
    },
    {
      question: "Сколько времени занимает доставка?",
      answer: (
        <>
          <p className="mb-3">Время доставки зависит от выбранного способа и региона:</p>
          <ul className="list-disc pl-5 mb-3">
            <li><strong>CDEK стандарт</strong>: 3-7 рабочих дней</li>
            <li><strong>CDEK экспресс</strong>: 1-3 рабочих дня</li>
            <li><strong>Почта России стандарт</strong>: 5-14 рабочих дней</li>
            <li><strong>Почта России экспресс</strong>: 3-7 рабочих дней</li>
          </ul>
          <p>Обратите внимание, что указанные сроки являются приблизительными и могут варьироваться в зависимости от удаленности региона.</p>
        </>
      ),
    },
  ];

  const paymentFaqs = [
    {
      question: "Какие способы оплаты вы принимаете?",
      answer: (
        <>
          <p className="mb-3">Мы предлагаем несколько способов оплаты:</p>
          <ul className="list-disc pl-5 mb-3">
            <li><strong>YooMoney</strong> - быстрая и безопасная онлайн-оплата с использованием банковских карт</li>
            <li><strong>Прямой перевод</strong> - оплата по реквизитам с подтверждением платежа</li>
            <li><strong>Баланс аккаунта</strong> - использование средств с баланса вашего аккаунта</li>
          </ul>
        </>
      ),
    },
    {
      question: "Как подтвердить оплату при прямом переводе?",
      answer: (
        <>
          <p className="mb-3">При выборе способа оплаты "Прямой перевод" следуйте этим шагам:</p>
          <ol className="list-decimal pl-5 mb-3">
            <li>Получите реквизиты для оплаты на странице оформления заказа</li>
            <li>Выполните перевод по указанным реквизитам</li>
            <li>Сохраните чек или скриншот подтверждения платежа</li>
            <li>Загрузите подтверждение оплаты через форму на сайте</li>
          </ol>
          <p>После проверки вашего платежа администратором, заказ будет подтвержден и переведен в статус "Оплачен".</p>
        </>
      ),
    },
    {
      question: "Что делать, если платеж не прошел?",
      answer: (
        <>
          <p className="mb-3">Если ваш платеж не прошел, проверьте следующее:</p>
          <ul className="list-disc pl-5 mb-3">
            <li>Достаточно ли средств на вашей карте</li>
            <li>Правильно ли указаны реквизиты для перевода</li>
            <li>Нет ли ограничений на онлайн-платежи от вашего банка</li>
          </ul>
          <p className="mb-3">Если проблема не решается, свяжитесь с нами через:</p>
          <ul className="list-disc pl-5 mb-3">
            <li>Telegram: @helen_heinlein</li>
            <li>Email: info@jungleplants.ru</li>
          </ul>
          <p>Мы поможем решить проблему и подскажем альтернативный способ оплаты.</p>
        </>
      ),
    },
    {
      question: "Как пополнить баланс аккаунта?",
      answer: (
        <>
          <p className="mb-3">Баланс аккаунта можно пополнить следующими способами:</p>
          <ul className="list-disc pl-5 mb-3">
            <li>Через возврат средств за отмененные заказы</li>
            <li>Бонусными начислениями при особых акциях</li>
            <li>Через администратора при особых случаях</li>
          </ul>
          <p>Баланс можно использовать для полной или частичной оплаты заказов.</p>
        </>
      ),
    },
  ];

  const careFaqs = [
    {
      question: "Как ухаживать за комнатными растениями?",
      answer: (
        <>
          <p className="mb-3">Основные правила ухода за комнатными растениями:</p>
          <ul className="list-disc pl-5 mb-3">
            <li><strong>Освещение</strong>: Большинству растений нужен яркий непрямой свет. Избегайте прямых солнечных лучей, которые могут вызвать ожоги листьев.</li>
            <li><strong>Полив</strong>: Поливайте, когда верхний слой почвы (2-3 см) подсохнет. Частота полива зависит от вида растения, сезона и условий содержания.</li>
            <li><strong>Влажность</strong>: Тропические растения предпочитают повышенную влажность. Регулярно опрыскивайте листья или используйте увлажнитель воздуха.</li>
            <li><strong>Подкормка</strong>: В период активного роста (весна-лето) подкармливайте растения специальными удобрениями согласно инструкции.</li>
          </ul>
          <p>К каждому заказу мы прикладываем подробную инструкцию по уходу за конкретными растениями.</p>
        </>
      ),
    },
    {
      question: "Что делать, если у растения желтеют листья?",
      answer: (
        <>
          <p className="mb-3">Пожелтение листьев может быть вызвано несколькими причинами:</p>
          <ul className="list-disc pl-5 mb-3">
            <li><strong>Переувлажнение почвы</strong>: Сократите полив, проверьте дренаж</li>
            <li><strong>Недостаток влаги</strong>: Увеличьте частоту полива</li>
            <li><strong>Недостаток питательных веществ</strong>: Внесите подходящее удобрение</li>
            <li><strong>Слишком яркий свет</strong>: Переместите растение в более затененное место</li>
            <li><strong>Недостаток света</strong>: Переместите растение ближе к источнику света</li>
            <li><strong>Естественный процесс</strong>: Нормальное старение нижних листьев</li>
          </ul>
          <p>Если у вас возникают проблемы с растением, вы всегда можете обратиться к нам за консультацией.</p>
        </>
      ),
    },
    {
      question: "Как пересаживать растения?",
      answer: (
        <>
          <p className="mb-3">Пересадка растений - важная процедура, которую лучше проводить весной или в начале лета:</p>
          <ol className="list-decimal pl-5 mb-3">
            <li>Выберите горшок на 2-3 см больше предыдущего с дренажными отверстиями</li>
            <li>Используйте подходящий грунт для конкретного типа растения</li>
            <li>Аккуратно извлеките растение из старого горшка, стараясь не повредить корни</li>
            <li>Удалите старую почву и осмотрите корни (при необходимости удалите поврежденные)</li>
            <li>Насыпьте дренаж на дно нового горшка (керамзит, мелкие камни)</li>
            <li>Добавьте немного свежего грунта, поместите растение и засыпьте оставшимся грунтом</li>
            <li>Слегка утрамбуйте почву и обильно полейте</li>
          </ol>
          <p>После пересадки разместите растение в затененном месте на 1-2 недели для адаптации.</p>
        </>
      ),
    },
    {
      question: "Как защитить растения от вредителей?",
      answer: (
        <>
          <p className="mb-3">Для защиты растений от вредителей:</p>
          <ul className="list-disc pl-5 mb-3">
            <li><strong>Профилактика</strong>: Регулярно осматривайте растения, особенно нижнюю сторону листьев</li>
            <li><strong>Карантин</strong>: Новые растения держите отдельно от остальных 2-3 недели</li>
            <li><strong>Гигиена</strong>: Периодически протирайте листья влажной тряпкой</li>
            <li><strong>Опрыскивание</strong>: Используйте мыльный раствор или специальные инсектициды при обнаружении вредителей</li>
          </ul>
          <p className="mb-3">Распространенные вредители комнатных растений:</p>
          <ul className="list-disc pl-5 mb-3">
            <li>Паутинный клещ</li>
            <li>Тля</li>
            <li>Щитовка</li>
            <li>Мучнистый червец</li>
            <li>Трипсы</li>
          </ul>
          <p>При обнаружении вредителей важно быстро принять меры, чтобы предотвратить их распространение.</p>
        </>
      ),
    },
  ];

  const otherFaqs = [
    {
      question: "Можно ли отменить или изменить заказ?",
      answer: (
        <>
          <p className="mb-3">Отмена заказа:</p>
          <ul className="list-disc pl-5 mb-3">
            <li>Заказы в статусе "Ожидает оплаты" можно отменить в любой момент</li>
            <li>Заказы в статусе "Оплачен" можно отменить только при согласовании с администратором</li>
            <li>Заказы в статусе "Отправлен" отменить нельзя</li>
          </ul>
          <p className="mb-3">Изменение заказа:</p>
          <ul className="list-disc pl-5 mb-3">
            <li>Вы можете изменить данные доставки (ФИО, адрес, телефон) до отправки заказа</li>
            <li>Изменение состава заказа возможно только по согласованию с администратором</li>
          </ul>
          <p>Для отмены или изменения заказа обратитесь к администратору через Telegram (@helen_heinlein).</p>
        </>
      ),
    },
    {
      question: "Как оставить отзыв о товаре?",
      answer: (
        <>
          <p className="mb-3">Вы можете оставить отзыв о приобретенном товаре несколькими способами:</p>
          <ul className="list-disc pl-5 mb-3">
            <li>На странице товара нажмите кнопку "Оставить отзыв"</li>
            <li>В личном кабинете в разделе "Мои заказы" найдите нужный товар и оставьте отзыв</li>
            <li>В нашем Telegram-канале <a href="https://t.me/junglefeedback" target="_blank" rel="noreferrer" className="text-primary underline">t.me/junglefeedback</a></li>
          </ul>
          <p>Ваш отзыв будет опубликован после проверки модератором.</p>
        </>
      ),
    },
    {
      question: "Как связаться с вами при возникновении вопросов?",
      answer: (
        <>
          <p className="mb-3">Вы можете связаться с нами любым удобным способом:</p>
          <ul className="list-disc pl-5 mb-3">
            <li><strong>Telegram</strong>: <a href="https://t.me/helen_heinlein" target="_blank" rel="noreferrer" className="text-primary underline">@helen_heinlein</a> (предпочтительный способ)</li>
            <li><strong>Email</strong>: info@jungleplants.ru</li>
            <li><strong>Форма обратной связи</strong> на сайте</li>
          </ul>
          <p>Мы отвечаем на сообщения в течение 24 часов в рабочие дни.</p>
        </>
      ),
    },
    {
      question: "Проводите ли вы акции и распродажи?",
      answer: (
        <>
          <p className="mb-3">Да, мы регулярно проводим акции и распродажи. Чтобы не пропустить выгодные предложения:</p>
          <ul className="list-disc pl-5 mb-3">
            <li>Подпишитесь на наш Telegram-канал</li>
            <li>Подпишитесь на рассылку в личном кабинете</li>
            <li>Регулярно проверяйте раздел "Скидки" в каталоге</li>
          </ul>
          <p>Кроме того, мы предлагаем специальные скидки для постоянных клиентов и при заказе от определенной суммы.</p>
        </>
      ),
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="heading font-montserrat font-bold text-2xl md:text-3xl mb-2">Часто задаваемые вопросы</h1>
      <p className="text-muted-foreground mb-8">Ответы на наиболее популярные вопросы о нашем магазине, товарах и услугах</p>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex space-x-4 mb-8 overflow-x-auto whitespace-nowrap">
            <TabsTrigger value="general" className="flex items-center">
              <Share className="h-4 w-4 mr-2" />
              Общие вопросы
            </TabsTrigger>
            <TabsTrigger value="delivery" className="flex items-center">
              <Truck className="h-4 w-4 mr-2" />
              Доставка
            </TabsTrigger>
            <TabsTrigger value="payment" className="flex items-center">
              <CreditCard className="h-4 w-4 mr-2" />
              Оплата
            </TabsTrigger>
            <TabsTrigger value="care" className="flex items-center">
              <Leaf className="h-4 w-4 mr-2" />
              Уход за растениями
            </TabsTrigger>
            <TabsTrigger value="other" className="flex items-center">
              <MessageCircle className="h-4 w-4 mr-2" />
              Другое
            </TabsTrigger>
          </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Accordion type="single" collapsible className="space-y-4">
            {generalFaqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`general-${index}`}
                className="bg-white rounded-lg shadow-md overflow-hidden"
              >
                <AccordionTrigger className="px-5 py-4 font-montserrat font-semibold">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5 text-gray-700">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>

        <TabsContent value="delivery" className="space-y-4">
          <Accordion type="single" collapsible className="space-y-4">
            {deliveryFaqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`delivery-${index}`}
                className="bg-white rounded-lg shadow-md overflow-hidden"
              >
                <AccordionTrigger className="px-5 py-4 font-montserrat font-semibold">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5 text-gray-700">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>

        <TabsContent value="payment" className="space-y-4">
          <Accordion type="single" collapsible className="space-y-4">
            {paymentFaqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`payment-${index}`}
                className="bg-white rounded-lg shadow-md overflow-hidden"
              >
                <AccordionTrigger className="px-5 py-4 font-montserrat font-semibold">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5 text-gray-700">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>

        <TabsContent value="care" className="space-y-4">
          <Accordion type="single" collapsible className="space-y-4">
            {careFaqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`care-${index}`}
                className="bg-white rounded-lg shadow-md overflow-hidden"
              >
                <AccordionTrigger className="px-5 py-4 font-montserrat font-semibold">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5 text-gray-700">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>

        <TabsContent value="other" className="space-y-4">
          <Accordion type="single" collapsible className="space-y-4">
            {otherFaqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`other-${index}`}
                className="bg-white rounded-lg shadow-md overflow-hidden"
              >
                <AccordionTrigger className="px-5 py-4 font-montserrat font-semibold">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5 text-gray-700">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>
      </Tabs>

      <div className="mt-12 bg-white shadow-lg p-8 rounded-2xl text-center flex flex-col items-center max-w-xl mx-auto border border-primary/20">
        <h2 className="heading font-montserrat font-semibold text-2xl mb-3 text-primary">Не нашли ответ на свой вопрос?</h2>
        <p className="mb-6 text-gray-700 text-base md:text-lg">Свяжитесь с нами в Telegram — мы с радостью поможем!</p>
        <Button asChild size="lg" className="bg-[#229ED9] hover:bg-[#1b8bb8] text-white font-bold text-lg px-8 py-4 rounded-xl shadow-md transition-all duration-200">
          <a href="https://t.me/helen_heinlein" target="_blank" rel="noreferrer">
            <MessageCircle className="mr-3 h-6 w-6" />
            Написать в Telegram
          </a>
        </Button>
      </div>

      <div className="mt-12 text-center">
        <h2 className="heading font-montserrat font-semibold text-xl mb-4">Полный FAQ</h2>
        <p className="mb-4 text-muted-foreground">
          Посетите наш полный FAQ в Telegram для получения самой актуальной информации
        </p>
        <Button asChild variant="outline" size="lg">
          <a
            href="https://telegra.ph/CHasto-zadavaemye-voprosy-o-Dzhunglevom-bote-i-zakupke-07-15"
            target="_blank"
            rel="noreferrer"
          >
            Перейти к полному FAQ
          </a>
        </Button>
      </div>
    </div>
  );
}
