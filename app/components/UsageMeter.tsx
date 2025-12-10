import { Card, BlockStack, InlineStack, Text, ProgressBar, Badge, Box, Button } from "@shopify/polaris";
import { useNavigate } from "@remix-run/react";

interface UsageMeterProps {
  questionsUsed: number;
  questionsLimit: number;
  summariesUsed: number;
  summariesLimit: number;
  resetDate?: Date;
}

export function UsageMeter({
  questionsUsed,
  questionsLimit,
  summariesUsed,
  summariesLimit,
  resetDate
}: UsageMeterProps) {
  const navigate = useNavigate();

  const questionProgress = questionsLimit > 0 ? (questionsUsed / questionsLimit) * 100 : 0;
  const summaryProgress = summariesLimit > 0 ? (summariesUsed / summariesLimit) * 100 : 0;

  const questionTone = questionProgress >= 90 ? "critical" : questionProgress >= 50 ? "attention" : "success";
  const summaryTone = summaryProgress >= 90 ? "critical" : summaryProgress >= 50 ? "attention" : "success";

  const daysUntilReset = resetDate
    ? Math.ceil((resetDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingMd">
            Free Plan Usage
          </Text>
          {daysUntilReset && (
            <Badge tone="info">Resets in {daysUntilReset} days</Badge>
          )}
        </InlineStack>

        <BlockStack gap="300">
          {/* Questions Usage */}
          <Box>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text as="p" variant="bodyMd">
                  AI Questions
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  {questionsUsed} / {questionsLimit}
                </Text>
              </InlineStack>
              <ProgressBar
                progress={questionProgress}
                tone={questionTone}
                size="small"
              />
            </BlockStack>
          </Box>

          {/* Review Summaries Usage */}
          <Box>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text as="p" variant="bodyMd">
                  Review Summaries
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  {summariesUsed} / {summariesLimit}
                </Text>
              </InlineStack>
              <ProgressBar
                progress={summaryProgress}
                tone={summaryTone}
                size="small"
              />
            </BlockStack>
          </Box>
        </BlockStack>

        {(questionProgress >= 80 || summaryProgress >= 80) && (
          <Box>
            <InlineStack align="space-between" blockAlign="center">
              <Text as="p" variant="bodySm" tone="subdued">
                Approaching your monthly limit. Upgrade for unlimited access.
              </Text>
              <Button onClick={() => navigate('/app/pricing')}>
                Upgrade
              </Button>
            </InlineStack>
          </Box>
        )}
      </BlockStack>
    </Card>
  );
}
