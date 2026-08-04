import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

function App() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          DoBetterMoney
        </h1>
        <p className="mt-2 text-muted-foreground">
          React + Tailwind CSS + shadcn/ui
        </p>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Stack ready</CardTitle>
          <CardDescription>
            Add more components with{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              npx shadcn@latest add
            </code>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button>Get started</Button>
          <Button variant="outline">Learn more</Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default App
