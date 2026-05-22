import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollText } from "lucide-react";

const SUPPORT_EMAIL = "support@rseducation.app";
const LAST_UPDATED = "April 25, 2026";

export default function Terms() {
  useEffect(() => {
    document.title = "Terms of Service — EduNav";
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content =
      "The terms that apply when you use the RS EduNav web app and mobile app.";
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <ScrollText className="h-10 w-10 text-blue-600" />
          <h1 className="text-3xl font-bold">Terms of Service</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-8">Last updated: {LAST_UPDATED}</p>

        <Card>
          <CardContent className="prose prose-slate dark:prose-invert max-w-none pt-6 space-y-6">
            <section>
              <h2 className="text-xl font-semibold">Acceptance</h2>
              <p>
                By creating an account or using RS EduNav (the "Service"), you agree to
                these Terms of Service. If you do not agree, do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">Eligibility</h2>
              <p>
                You must be at least 13 years old to use EduNav. If you are under the
                age of majority in your jurisdiction, you confirm that a parent or legal
                guardian has reviewed these terms with you.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">Your account</h2>
              <p>
                You're responsible for the information you provide and for keeping your
                login credentials secure. Notify us at{" "}
                <a className="text-blue-600 underline" href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>{" "}
                if you suspect unauthorized use of your account.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">Acceptable use</h2>
              <p>You agree not to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Use the Service for unlawful, harmful, or fraudulent activity.</li>
                <li>Attempt to disrupt, reverse-engineer, or scrape the Service.</li>
                <li>Upload content you do not have the right to share.</li>
                <li>Impersonate another person or misrepresent your affiliation.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold">Recommendations are guidance, not advice</h2>
              <p>
                EduNav uses AI and public datasets to generate career, college, and
                scholarship suggestions. These suggestions are informational only and
                are not professional educational, financial, immigration, or legal
                advice. Always verify program details, deadlines, eligibility, and
                costs directly with the school, employer, or scholarship provider before
                making decisions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">Content you provide</h2>
              <p>
                You retain ownership of the content you upload (such as your resume and
                profile details). You grant us a limited license to store and process
                that content solely to operate and improve the Service for you, as
                described in our Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">Termination</h2>
              <p>
                You can stop using the Service and delete your account at any time from
                the Profile screen. We may suspend or terminate accounts that violate
                these terms or that are inactive for an extended period.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">Disclaimer and limitation of liability</h2>
              <p>
                The Service is provided "as is" without warranties of any kind. To the
                fullest extent permitted by law, RS Education is not liable for any
                indirect, incidental, or consequential damages arising from your use of
                the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">Changes to these terms</h2>
              <p>
                We may update these terms from time to time. Continued use of the
                Service after changes take effect means you accept the updated terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">Contact</h2>
              <p>
                Questions about these terms?{" "}
                <a className="text-blue-600 underline" href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
