import { Layout } from '@/components/Layout'
import { MDXContent } from '@/components/MDXContent'

export default function LayoutComponentsPage() {
  return (
    <Layout>
      <MDXContent>
        <h1>Layout Components</h1>
        
        <p>
          Layout components provide the structural foundation for your console applications. 
          They handle responsive behavior, spacing, and overall page organization.
        </p>

        <h2>Layout</h2>

        <p>
          The main <code>Layout</code> component provides the overall structure for your application, 
          including the sidebar, header, and main content area.
        </p>

        <pre><code>{`import { Layout } from '@storacha/console-toolkit'

function App() {
  return (
    <Layout>
      <h1>Welcome to your console</h1>
      <p>Your main content goes here</p>
    </Layout>
  )
}`}</code></pre>

        <h3>Props</h3>

        <table>
          <thead>
            <tr>
              <th>Prop</th>
              <th>Type</th>
              <th>Default</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>children</code></td>
              <td><code>ReactNode</code></td>
              <td>-</td>
              <td>Content to display in the main area</td>
            </tr>
            <tr>
              <td><code>sidebar</code></td>
              <td><code>ReactNode</code></td>
              <td>Default sidebar</td>
              <td>Custom sidebar content</td>
            </tr>
            <tr>
              <td><code>header</code></td>
              <td><code>ReactNode</code></td>
              <td>Default header</td>
              <td>Custom header content</td>
            </tr>
          </tbody>
        </table>

        <h2>Container</h2>

        <p>
          The <code>Container</code> component provides consistent max-width and padding for content sections.
        </p>

        <pre><code>{`import { Container } from '@storacha/console-toolkit'

function ContentSection() {
  return (
    <Container size="large">
      <h2>Section Title</h2>
      <p>This content is properly contained and centered.</p>
    </Container>
  )
}`}</code></pre>

        <h3>Container Sizes</h3>

        <ul>
          <li><code>small</code> - Max width of 640px</li>
          <li><code>medium</code> - Max width of 768px (default)</li>
          <li><code>large</code> - Max width of 1024px</li>
          <li><code>xl</code> - Max width of 1280px</li>
          <li><code>full</code> - Full width with padding</li>
        </ul>

        <h2>Grid</h2>

        <p>
          The <code>Grid</code> component provides a flexible grid system for laying out content.
        </p>

        <pre><code>{`import { Grid, GridItem } from '@storacha/console-toolkit'

function Dashboard() {
  return (
    <Grid cols={3} gap={6}>
      <GridItem>
        <Card>Metric 1</Card>
      </GridItem>
      <GridItem>
        <Card>Metric 2</Card>
      </GridItem>
      <GridItem>
        <Card>Metric 3</Card>
      </GridItem>
    </Grid>
  )
}`}</code></pre>

        <h2>Stack</h2>

        <p>
          The <code>Stack</code> component arranges children vertically or horizontally with consistent spacing.
        </p>

        <pre><code>{`import { Stack } from '@storacha/console-toolkit'

function ButtonGroup() {
  return (
    <Stack direction="horizontal" spacing={4}>
      <Button variant="primary">Save</Button>
      <Button variant="secondary">Cancel</Button>
      <Button variant="outline">Reset</Button>
    </Stack>
  )
}`}</code></pre>

        <h3>Stack Props</h3>

        <table>
          <thead>
            <tr>
              <th>Prop</th>
              <th>Type</th>
              <th>Default</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>direction</code></td>
              <td><code>'vertical' | 'horizontal'</code></td>
              <td><code>'vertical'</code></td>
              <td>Stack direction</td>
            </tr>
            <tr>
              <td><code>spacing</code></td>
              <td><code>number</code></td>
              <td><code>4</code></td>
              <td>Space between items (in rem units)</td>
            </tr>
            <tr>
              <td><code>align</code></td>
              <td><code>'start' | 'center' | 'end'</code></td>
              <td><code>'start'</code></td>
              <td>Cross-axis alignment</td>
            </tr>
          </tbody>
        </table>

        <h2>Responsive Behavior</h2>

        <p>
          All layout components are responsive by default and adapt to different screen sizes:
        </p>

        <ul>
          <li><strong>Mobile</strong> (&lt; 768px): Single column layouts, collapsible sidebars</li>
          <li><strong>Tablet</strong> (768px - 1024px): Adaptive grid columns, persistent navigation</li>
          <li><strong>Desktop</strong> (&gt; 1024px): Full multi-column layouts, expanded sidebars</li>
        </ul>

        <blockquote>
          <p>
            <strong>Performance Tip:</strong> Layout components use CSS Grid and Flexbox for optimal 
            performance. They automatically handle responsive breakpoints without JavaScript calculations.
          </p>
        </blockquote>
      </MDXContent>
    </Layout>
  )
}
