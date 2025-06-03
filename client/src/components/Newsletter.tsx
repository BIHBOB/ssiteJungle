import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";

const subscribeSchema = z.object({
  telegramUsername: z
    .string()
    .min(5, "Введите корректный username")
    .regex(/^@?[a-zA-Z0-9_]{5,32}$/, "Введите корректный Telegram username"),
});

type SubscribeFormValues = z.infer<typeof subscribeSchema>;

export default function Newsletter() {
  const { toast } = useToast();
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<SubscribeFormValues>({
    resolver: zodResolver(subscribeSchema),
    defaultValues: {
      telegramUsername: "",
    },
  });

  const subscribeMutation = useMutation({
    mutationFn: async (data: { telegramUsername: string }) => {
      // Ensure username starts with @
      const username = data.telegramUsername.startsWith("@")
        ? data.telegramUsername
        : `@${data.telegramUsername}`;

      // In a real app, this would post to an API endpoint
      // For now, we'll simulate a successful subscription
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ success: true, username });
        }, 1000);
      });
    },
    onSuccess: () => {
      toast({
        title: "Подписка оформлена",
        description: "Вы успешно подписались на уведомления",
      });
      setIsSuccess(true);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка подписки",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function onSubmit(data: SubscribeFormValues) {
    subscribeMutation.mutate(data);
  }

  return (
    <section className="py-10 md:py-16">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto bg-primary rounded-xl p-8 md:p-10 text-white shadow-lg">
          <div className="text-center mb-6">
            <h2 className="heading font-montserrat font-bold text-2xl md:text-3xl mb-3">
              Узнавайте о новых растениях первыми
            </h2>
            <p className="opacity-90">
              Подпишитесь на уведомления о поступлении редких растений и специальных предложениях
            </p>
          </div>

          {isSuccess ? (
            <div className="text-center">
              <div className="bg-white bg-opacity-20 p-4 rounded-lg mb-4">
                <h3 className="font-semibold mb-2">Спасибо за подписку!</h3>
                <p>
                  Мы будем отправлять вам уведомления о поступлении новых растений и специальных предложениях.
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() => setIsSuccess(false)}
              >
                Подписаться еще раз
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col md:flex-row gap-3">
                <FormField
                  control={form.control}
                  name="telegramUsername"
                  render={({ field }) => (
                    <FormItem className="flex-grow">
                      <FormControl>
                        <Input
                          placeholder="Ваш Telegram username"
                          className="form-input flex-grow rounded-lg px-4 py-3 text-neutral-dark focus:ring-2 focus:ring-secondary border-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-white text-opacity-90" />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="btn bg-secondary hover:bg-yellow-500 text-white rounded-lg px-6 py-3 font-medium"
                  disabled={subscribeMutation.isPending}
                >
                  {subscribeMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Подписка...
                    </>
                  ) : (
                    "Подписаться"
                  )}
                </Button>
              </form>
            </Form>
          )}

          <p className="text-sm text-white opacity-70 mt-4 text-center">
            Вы можете отписаться от уведомлений в любой момент через личный кабинет
          </p>
        </div>
      </div>
    </section>
  );
}
