"use client"

import { useState } from "react"
import { Header } from "./header"
import { UsersTable } from "./users-table"
import { ProcessesTable } from "./processes-table"
import { GroupsTable } from "./groups-table"
import { Footer } from "./footer"

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"users" | "processes" | "groups">("users")

  return (
    <div className="flex flex-col min-h-screen">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} user={user} onLogout={onLogout} />
      <main className="flex-1 p-6 bg-gray-50">
        {activeTab === "users" && <UsersTable users={[]} />}
        {activeTab === "processes" && <ProcessesTable processes={[]} />}
        {activeTab === "groups" && <GroupsTable groups={[]} />}
      </main>
      <Footer />
    </div>
  )
}

