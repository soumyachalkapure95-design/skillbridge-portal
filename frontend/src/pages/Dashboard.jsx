import { useAuth } from '../context/AuthContext'
import StudentDashboard from './dashboards/StudentDashboard'
import IndustryDashboard from './dashboards/IndustryDashboard'
import AcademiaDashboard from './dashboards/AcademiaDashboard'
import AdminDashboard from './dashboards/AdminDashboard'

export default function Dashboard() {
    const { user, role } = useAuth()

    const renderRoleDashboard = () => {
        switch (role?.toLowerCase()) {
            case 'industry':
                return <IndustryDashboard user={user} />
            case 'academia':
                return <AcademiaDashboard user={user} />
            case 'admin':
                return <AdminDashboard user={user} />
            case 'student':
            default:
                return <StudentDashboard user={user} />
        }
    }

    return (
        <main className="app-container">
            {renderRoleDashboard()}
        </main>
    )
}