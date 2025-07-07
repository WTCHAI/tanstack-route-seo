import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about/')({
  component: About,
  head: () => ({
    title: 'About Us',
    meta: [
      {
        name: 'description',
        content: 'Learn more about our application and team.',
      },
    ],
  }),
})

function About() {
  return (
    <div className='p-30 bg-gray-100 rounded-lg shadow-md'>
      <h1>About Us</h1>
      <p>Welcome to our application! This is a simple about page.</p>
      <p>Built with React and TanStack Router using file-based routing.</p>
    </div>
  )
}
