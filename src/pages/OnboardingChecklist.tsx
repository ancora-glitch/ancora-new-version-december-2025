import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

type Item = {
  id: string;
  title: string;
  body: string;
};

const ITEMS: Item[] = [
  {
    id: "secrets",
    title: "Remove sensitive files",
    body: "Ensure .env files, API keys, and secrets are not committed. Add them to .gitignore and verify git history is clean.",
  },
  {
    id: "access",
    title: "Define access level",
    body: "Decide between (a) fork (read-only, no push access) or (b) collaborator with read-only role. Specify which branch they should base their work on (e.g. main or develop).",
  },
  {
    id: "scope",
    title: "Scope the integration",
    body: "Document which pages/components are in scope: Clothing product pages on ancoraedit.com. Include a brief description of the Figura Labs widget (size-fit box) so the partner knows where to integrate.",
  },
  {
    id: "usernames",
    title: "Collect partner GitHub/GitLab usernames",
    body: "Gather usernames (or associated emails) for everyone at Figura Labs who needs access. Note how many people.",
  },
];

const EMAIL_TEMPLATE = `Subject: Repository access for Figura Labs integration

Hi team,

We're ready to share access to our repository so you can begin work on the size-fit box widget integration.

Repository URL: [REPO_URL]
Base branch: [BRANCH]
Access level: [fork OR read-only collaborator]

Scope:
The integration is limited to the Clothing product pages on ancoraedit.com. The Figura Labs widget (size-fit box) should be embedded within the product detail layout for clothing items only.

To grant access, please reply with the GitHub (or GitLab) username — or associated email — for each person at Figura Labs who needs repository access, along with the total number of people.

Once we have your usernames, we'll add you to the repository and confirm by email.

Thanks,
ANCORA`;

export default function OnboardingChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const completed = ITEMS.filter((i) => checked[i.id]).length;
  const total = ITEMS.length;

  const toggle = (id: string) =>
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL_TEMPLATE);
      toast.success("Invite email copied to clipboard");
    } catch {
      toast.error("Could not copy. Please copy manually.");
    }
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900 font-sans">
      <div className="max-w-2xl mx-auto px-5 py-10 sm:py-16">
        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Repository access checklist – external partner
          </h1>
          <p className="mt-2 text-sm sm:text-base text-neutral-600">
            Complete these steps before sharing repo access with Figura Labs
          </p>
        </header>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-neutral-700">
              {completed} / {total} completed
            </span>
            <span className="text-xs text-neutral-500">
              {Math.round((completed / total) * 100)}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden">
            <div
              className="h-full bg-green-500"
              style={{ width: `${(completed / total) * 100}%` }}
            />
          </div>
        </div>

        <ul className="space-y-3">
          {ITEMS.map((item) => {
            const isDone = !!checked[item.id];
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  aria-pressed={isDone}
                  className={`w-full text-left flex gap-4 p-4 sm:p-5 rounded-lg border ${
                    isDone
                      ? "border-green-200 bg-green-50"
                      : "border-neutral-200 bg-white hover:border-neutral-300"
                  }`}
                >
                  <span
                    className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                      isDone
                        ? "bg-green-600 border-green-600 text-white"
                        : "bg-white border-neutral-300"
                    }`}
                    aria-hidden
                  >
                    {isDone && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                  <span className="flex-1">
                    <span
                      className={`block font-medium ${
                        isDone ? "text-green-800" : "text-neutral-900"
                      }`}
                    >
                      {item.title}
                    </span>
                    <span
                      className={`mt-1 block text-sm ${
                        isDone ? "text-green-700" : "text-neutral-600"
                      }`}
                    >
                      {item.body}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={copyEmail}
            className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-5 py-3 text-sm font-medium text-white hover:bg-neutral-800"
          >
            <Copy className="h-4 w-4" />
            Copy invite email
          </button>
        </div>
      </div>
    </div>
  );
}
