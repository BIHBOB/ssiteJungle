import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

function FaqAccordion() {
  const faqs = [
    {
      question: "Как происходит доставка растений?",
      answer: (
        <>
          <p className="mb-3">
            Доставка осуществляется через CDEK или Почту России, на выбор. Все растения тщательно упаковываются с использованием специальных материалов, чтобы избежать повреждений.
          </p>
          <p>
            При необходимости, особенно в холодное время года, мы используем утепление для защиты растений от низких температур. Подробнее о доставке можно узнать в нашем{" "}
            <a
              href="https://telegra.ph/CHasto-zadavaemye-voprosy-o-Dzhunglevom-bote-i-zakupke-07-15"
              className="text-primary hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              FAQ
            </a>.
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
          <p>
            Подробнее об этих функциях можно узнать в нашем{" "}
            <a
              href="https://telegra.ph/CHasto-zadavaemye-voprosy-o-Dzhunglevom-bote-i-zakupke-07-15"
              className="text-primary hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              FAQ
            </a>.
          </p>
        </>
      ),
    },
  ];

  return (
    <section className="py-8 md:py-16 bg-neutral-medium">
      <div className="container mx-auto px-4">
        <h2 className="heading font-montserrat font-bold text-2xl md:text-3xl text-center mb-8">
          Часто задаваемые вопросы
        </h2>
        
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`faq-${index}`}
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
          
          <div className="text-center mt-8">
            <Button 
              asChild
              className="bg-primary hover:bg-green-700 text-white rounded-lg px-6 py-3"
            >
              <a 
                href="https://telegra.ph/CHasto-zadavaemye-voprosy-o-Dzhunglevom-bote-i-zakupke-07-15" 
                target="_blank"
                rel="noreferrer"
              >
                Полный FAQ
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default FaqAccordion;
