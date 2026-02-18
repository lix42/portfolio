import type { Meta, StoryObj } from "@storybook/react-vite";
import { LoadingEllipsis } from "./loading-ellipsis";

const meta: Meta<typeof LoadingEllipsis> = {
  title: "UI/LoadingEllipsis",
  component: LoadingEllipsis,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "select", options: ["sm", "default", "lg"] },
    variant: { control: "select", options: ["primary", "secondary"] },
  },
};

export default meta;
type Story = StoryObj<typeof LoadingEllipsis>;

export const Default: Story = {
  args: { size: "default", variant: "primary" },
};

export const Small: Story = {
  args: { size: "sm", variant: "primary" },
};

export const Large: Story = {
  args: { size: "lg", variant: "primary" },
};

export const Secondary: Story = {
  args: { size: "default", variant: "secondary" },
};

export const AllCombinations: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      {(["sm", "default", "lg"] as const).map((size) => (
        <div key={size} className="flex items-center gap-8">
          {(["primary", "secondary"] as const).map((variant) => (
            <div key={variant} className="flex flex-col items-center gap-1">
              <LoadingEllipsis size={size} variant={variant} />
              <span className="text-xs text-muted-foreground">
                {size}/{variant}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
};
