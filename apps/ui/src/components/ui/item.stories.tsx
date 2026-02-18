import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "./badge";
import { Button } from "./button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "./item";

const meta: Meta<typeof Item> = {
  title: "UI/Item",
  component: Item,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: ["default", "outline", "muted"] },
    size: { control: "select", options: ["default", "sm", "xs"] },
  },
};

export default meta;
type Story = StoryObj<typeof Item>;

export const Default: Story = {
  render: () => (
    <Item className="w-80">
      <ItemContent>
        <ItemTitle>Item Title</ItemTitle>
        <ItemDescription>A short description of this item.</ItemDescription>
      </ItemContent>
    </Item>
  ),
};

export const WithMedia: Story = {
  render: () => (
    <Item className="w-80">
      <ItemMedia variant="image">
        <div className="size-full bg-muted rounded-sm" />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>With Image Media</ItemTitle>
        <ItemDescription>Item with an image placeholder.</ItemDescription>
      </ItemContent>
    </Item>
  ),
};

export const WithActions: Story = {
  render: () => (
    <Item className="w-80">
      <ItemContent>
        <ItemTitle>With Actions</ItemTitle>
        <ItemDescription>Item that has action buttons.</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Badge variant="secondary">New</Badge>
        <Button size="xs" variant="outline">
          Edit
        </Button>
      </ItemActions>
    </Item>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <ItemGroup className="w-80">
      {(["default", "sm", "xs"] as const).map((size) => (
        <Item key={size} size={size} variant="outline">
          <ItemContent>
            <ItemTitle>Size: {size}</ItemTitle>
            <ItemDescription>
              This item uses the {size} size variant.
            </ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <ItemGroup className="w-80">
      {(["default", "outline", "muted"] as const).map((variant) => (
        <Item key={variant} variant={variant}>
          <ItemContent>
            <ItemTitle>Variant: {variant}</ItemTitle>
            <ItemDescription>
              This item uses the {variant} variant.
            </ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  ),
};
