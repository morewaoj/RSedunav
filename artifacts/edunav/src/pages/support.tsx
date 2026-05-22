import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { LifeBuoy, Mail, HelpCircle } from "lucide-react";

const SUPPORT_EMAIL = "support@rseducation.app";

export default function Support() {
  useEffect(() => {
    document.title = "Support — EduNav";
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content =
      "Get help with RS EduNav. Contact our support team or browse answers to common questions.";
  }, []);

  const faqs: { q: string; a: string }[] = [
    {
      q: "How do I delete my account?",
      a: "Open the Profile tab, scroll to the bottom, and tap Delete account. This permanently removes your profile, saved items, notes, and uploaded resume.",
    },
    {
      q: "I forgot my password.",
      a: "Use the 'Forgot password' link on the sign-in screen and follow the email instructions. If you don't see the email, check your spam folder.",
    },
    {
      q: "My recommendations look wrong.",
      a: "Recommendations get better as you complete your profile. Add your interests, skills, education level, and upload an updated resume from the Profile screen, then pull to refresh on Home.",
    },
    {
      q: "How do I save a career, college, or scholarship?",
      a: "Tap the bookmark icon on any item. Saved items appear under My Plan and are kept in sync between the web app and the mobile app.",
    },
    {
      q: "How do I report a bug or request a feature?",
      a: `Email us at ${SUPPORT_EMAIL} with a short description and, if possible, a screenshot. We read every message.`,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <LifeBuoy className="h-10 w-10 text-blue-600" />
          <h1 className="text-3xl font-bold">Support</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          We're here to help you get the most out of RS EduNav.
        </p>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Mail className="h-8 w-8 text-blue-600 shrink-0" />
              <div>
                <h2 className="text-xl font-semibold mb-1">Contact us</h2>
                <p className="text-muted-foreground mb-2">
                  Email our support team and we'll reply within two business days.
                </p>
                <a
                  className="text-blue-600 underline text-lg font-medium"
                  href={`mailto:${SUPPORT_EMAIL}?subject=EduNav%20support%20request`}
                >
                  {SUPPORT_EMAIL}
                </a>
                <p className="text-sm text-muted-foreground mt-3">
                  When reporting a bug, please include the device or browser you're
                  using and the steps to reproduce the problem.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <HelpCircle className="h-6 w-6 text-blue-600" /> Frequently asked questions
        </h2>
        <div className="space-y-4">
          {faqs.map((item) => (
            <Card key={item.q}>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-2">{item.q}</h3>
                <p className="text-muted-foreground">{item.a}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
