import { useAuthenticator } from '@aws-amplify/ui-react';
import { generateClient } from "aws-amplify/data";
import { useEffect, useState } from "react";
import type { Schema } from "../amplify/data/resource";
import { FileUpload } from './components/file_upload';
import { ThemeToggle } from './components/ui/theme_toggle';

const client = generateClient<Schema>();

function App() {

  const { user, signOut } = useAuthenticator();
  const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);

  useEffect(() => {
    client.models.Todo.observeQuery().subscribe({
      next: (data) => setTodos([...data.items]),
    });
  }, []);

  function createTodo() {
    client.models.Todo.create({ content: window.prompt("Todo content") });
  }

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        borderBottom: '2px solid #eee',
        paddingBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1 style={{ margin: 0 }}>💰 Bank Statement Analyzer</h1>
          <ThemeToggle />
        </div>
        <div>
          <span style={{ marginRight: '15px', color: '#666' }}>
            {user?.signInDetails?.loginId}
          </span>
          <button
            onClick={signOut}
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <FileUpload />
    </main>
  );
}

export default App;
