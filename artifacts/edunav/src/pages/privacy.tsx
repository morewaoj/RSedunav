import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

const SUPPORT_EMAIL = "support@rseducation.app";
const LAST_UPDATED = "April 25, 2026";

export default function Privacy() {
  useEffect(() => {
    document.title = "Privacy Policy — EduNav";
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content =
      "How RS EduNav collects, uses, and protects your data, and how you can delete your account.";
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="h-10 w-10 text-blue-600" />
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-8">Last updated: {LAST_UPDATED}</p>

        <Card>
          <CardContent className="prose prose-slate dark:prose-invert max-w-none pt-6 space-y-6">
            <section>
              <h2 className="text-xl font-semibold">Who we are</h2>
              <p>
                RS EduNav ("EduNav", "we", "us") is an AI-powered education planning app
                operated by RS Education. This policy explains what we collect when you
                use the EduNav web app and the RS EduNav mobile app, how we use it, and
                the choices you have.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">Information we collect</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Account information.</strong> Your name, email address, and
                  password (stored as a one-way hash) when you sign up.
                </li>
                <li>
                  <strong>Profile information.</strong> Optional details you choose to
                  share — education level, interests, skills, GPA, intended major, and
                  similar fields used to personalize recommendations.
                </li>
                <li>
                  <strong>Resume and uploads.</strong> If you upload a resume or profile
                  picture, we store it on our servers and parse the resume text to
                  extract skills used for matching.
                </li>
                <li>
                  <strong>App activity.</strong> Items you save (careers, colleges,
                  scholarships), notes you write, and which recommendations you open. We
                  use this to refine future recommendations.
                </li>
                <li>
                  <strong>Technical data.</strong> Standard request logs (IP address,
                  device/browser type, timestamps) used for security and debugging.
                </li>
              </ul>
              <p>
                We do <strong>not</strong> collect precise location, contacts, advertising
                identifiers, or financial information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">How we use your information</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>To provide and personalize career, college, and scholarship recommendations.</li>
                <li>To save your plan and let you sign in across devices.</li>
                <li>To respond to support requests.</li>
                <li>To detect abuse and keep the service secure.</li>
              </ul>
              <p>We do not sell your personal information and we do not show third-party ads.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">Sharing</h2>
              <p>
                We share data only with the service providers we need to run EduNav
                (hosting, database, and AI inference providers used to generate
                recommendations). These providers process data on our behalf under
                contractual confidentiality terms. We may also disclose information if
                required by law or to protect the safety of our users.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">Data retention and security</h2>
              <p>
                Your data is stored on managed cloud infrastructure and transmitted over
                HTTPS. We retain account data for as long as your account is active.
                Logs are retained for a limited operational window and then discarded.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">Your rights and account deletion</h2>
              <p>
                You can update your profile or delete your account at any time from the
                in-app Profile screen. Deleting your account permanently removes your
                profile, saved items, notes, and uploaded resume from our active
                systems. You can also request a copy of your data, or ask us to delete
                it on your behalf, by emailing{" "}
                <a className="text-blue-600 underline" href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">Children</h2>
              <p>
                EduNav is intended for students aged 13 and older. We do not knowingly
                collect personal information from children under 13. If you believe a
                child under 13 has signed up, contact us and we will delete the account.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">Changes to this policy</h2>
              <p>
                We may update this policy as the product evolves. Material changes will
                be announced in-app or by email before taking effect. The "Last updated"
                date above always reflects the current version.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold">Contact</h2>
              <p>
                Questions about this policy?{" "}
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
