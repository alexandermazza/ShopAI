import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { useState } from "react";
import {
  Chart as ChartJS,
  LineElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import {
  Page,
  Layout,
  Card,
  Text,
  ButtonGroup,
  Button,
  DataTable,
  LegacyStack,
  Badge,
  InlineStack,
  BlockStack,
  Box,
  Banner,
  TextField,
  Select,
  Spinner,
  EmptyState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
// @ts-ignore - db.server.js is JavaScript
import prisma from "../db.server.js";
import { authenticate } from "../shopify.server.js";

// Register chart components
ChartJS.register(LineElement, BarElement, CategoryScale, LinearScale, PointElement, Filler, Tooltip, Legend);

interface CustomerQuestion {
  id: string;
  question: string;
  times: number;
  askedAt: Date;
}

interface UsageData {
  day: string;
  count: number;
}

interface Metrics {
  totalQuestions: number;
  uniqueQuestions: number;
  avgQuestionsPerDay: number;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const startParam = url.searchParams.get("start");
  const endParam = url.searchParams.get("end");

  const endDate = endParam ? new Date(endParam) : new Date();
  const startDate = startParam ? new Date(startParam) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // default 30 days

  // Fetch all questions for this shop and date range
  const questions = await prisma.customerQuestion.findMany({
    where: {
      shop: session.shop,
      askedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: {
      askedAt: "asc",
    },
  });

  // Aggregate counts per day
  const dailyMap = new Map<string, number>();
  questions.forEach((q: CustomerQuestion) => {
    const key = q.askedAt.toISOString().split("T")[0]; // YYYY-MM-DD
    dailyMap.set(key, (dailyMap.get(key) || 0) + 1);
  });

  const usageData: UsageData[] = Array.from(dailyMap.entries()).map(([day, count]) => ({ day, count }));

  const totalQuestions = questions.length;
  const uniqueQuestions = new Set(questions.map((q: CustomerQuestion) => q.question)).size;
  const avgQuestionsPerDay = usageData.length ? totalQuestions / usageData.length : 0;

  // Top questions within range
  const topQuestions = await prisma.customerQuestion.findMany({
    where: {
      shop: session.shop,
      askedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: {
      times: "desc",
    },
  });

  const metrics: Metrics = { totalQuestions, uniqueQuestions, avgQuestionsPerDay };

  return json({ 
    usageData, 
    topQuestions, 
    start: startDate.toISOString().split("T")[0], 
    end: endDate.toISOString().split("T")[0],
    metrics
  });
};

export default function Dashboard() {
  const { usageData, topQuestions, start, end, metrics } = useLoaderData<typeof loader>();
  const [chartType, setChartType] = useState<"area" | "bar">("area");
  const [startDate, setStartDate] = useState(start);
  const [endDate, setEndDate] = useState(end);
  const navigate = useNavigate();
  
  const labels = usageData.map((d: UsageData) => d.day);
  const counts = usageData.map((d: UsageData) => d.count);

  const data = {
    labels,
    datasets: [
      {
        label: "Questions",
        data: counts,
        fill: chartType === "area",
        backgroundColor: chartType === "bar" 
          ? "#2563eb"
          : "rgba(37, 99, 235, 0.1)",
        borderColor: "#2563eb",
        borderWidth: 2,
        tension: 0.4,
        pointBackgroundColor: "#2563eb",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: '#2563eb',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          drawBorder: false,
        },
        ticks: {
          color: '#6B7280',
          font: { size: 12 },
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          drawBorder: false,
        },
        ticks: {
          color: '#6B7280',
          font: { size: 12 },
        },
      },
    },
  } as const;

  const handleApplyFilters = () => {
    const params = new URLSearchParams();
    if (startDate) params.set('start', startDate);
    if (endDate) params.set('end', endDate);
    navigate(`?${params.toString()}`);
  };

  const tableRows = topQuestions.map((q: CustomerQuestion) => [
    q.question,
    <Badge tone="info" key={q.id}>{q.times.toString()}</Badge>
  ]);

  return (
    <Page title="Customer Questions Dashboard">
      <TitleBar title="Dashboard" />
      
      <Layout>
        {/* Summary Cards */}
        <Layout.Section>
          <InlineStack gap="400" wrap={false}>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">💬 Total Questions</Text>
                <Text as="p" variant="heading2xl" tone="base">
                  {metrics.totalQuestions.toLocaleString()}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Questions asked by customers
                </Text>
              </BlockStack>
            </Card>
            
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">🔍 Unique Questions</Text>
                <Text as="p" variant="heading2xl" tone="base">
                  {metrics.uniqueQuestions.toLocaleString()}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Different questions asked
                </Text>
              </BlockStack>
            </Card>
            
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">📊 Questions per Day</Text>
                <Text as="p" variant="heading2xl" tone="base">
                  {metrics.avgQuestionsPerDay.toFixed(1)}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Average daily volume
                </Text>
              </BlockStack>
            </Card>
          </InlineStack>
        </Layout.Section>

        {/* Filters and Chart Type */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">Analytics Overview</Text>
              
              <InlineStack gap="400" align="space-between" wrap={false}>
                {/* Chart Type Toggle */}
                <Box>
                  <Text as="p" variant="bodyMd" tone="subdued">Chart Type</Text>
                  <Box paddingBlockStart="200">
                    <ButtonGroup>
                      <Button 
                        pressed={chartType === "area"}
                        onClick={() => setChartType("area")}
                      >
                        📈 Area
                      </Button>
                      <Button 
                        pressed={chartType === "bar"}
                        onClick={() => setChartType("bar")}
                      >
                        📊 Bar
                      </Button>
                    </ButtonGroup>
                  </Box>
                </Box>

                {/* Date Filters */}
                <InlineStack gap="200" align="end">
                  <Box minWidth="120px">
                    <TextField
                      label="From"
                      type="date"
                      value={startDate}
                      onChange={setStartDate}
                      autoComplete="off"
                    />
                  </Box>
                  <Box minWidth="120px">
                    <TextField
                      label="To"
                      type="date"
                      value={endDate}
                      onChange={setEndDate}
                      autoComplete="off"
                    />
                  </Box>
                  <Button 
                    variant="primary" 
                    onClick={handleApplyFilters}
                  >
                    Apply Filters
                  </Button>
                </InlineStack>
              </InlineStack>

              {/* Chart */}
              <Box minHeight="400px" background="bg-surface-secondary" padding="400" borderRadius="200">
                {usageData.length > 0 ? (
                  <div style={{ height: '350px' }}>
                    {chartType === "area" ? 
                      <Line data={data} options={options} /> : 
                      <Bar data={data} options={options} />
                    }
                  </div>
                ) : (
                  <EmptyState
                    heading="No data available"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>No questions found for the selected date range.</p>
                  </EmptyState>
                )}
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Questions Table */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Box>
                <Text as="h2" variant="headingLg">🔍 Most Asked Questions</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Top questions from your customers
                </Text>
              </Box>
              
              {topQuestions.length > 0 ? (
                <DataTable
                  columnContentTypes={['text', 'text']}
                  headings={['Question', 'Times Asked']}
                  rows={tableRows}
                  increasedTableDensity
                  hoverable
                />
              ) : (
                <EmptyState
                  heading="No questions yet"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>When customers start asking questions, they'll appear here.</p>
                </EmptyState>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
