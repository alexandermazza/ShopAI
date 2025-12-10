import { Banner, Button } from "@shopify/polaris";
import { useNavigate } from "@remix-run/react";

interface UpgradeBannerProps {
  title?: string;
  message?: string;
  tone?: "info" | "warning" | "critical";
}

export function UpgradeBanner({
  title = "Upgrade to Pro Plan",
  message = "Get unlimited AI questions, review summaries, and priority support.",
  tone = "info"
}: UpgradeBannerProps) {
  const navigate = useNavigate();

  return (
    <Banner
      title={title}
      tone={tone}
      action={{
        content: "Upgrade Now",
        onAction: () => navigate('/app/pricing')
      }}
    >
      <p>{message}</p>
    </Banner>
  );
}
