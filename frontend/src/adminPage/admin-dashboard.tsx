"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { UsersTable } from "@/components/users-table"
import { ProcessesTable } from "@/components/processes-table"
import { GroupsTable } from "@/components/groups-table"
import { Footer } from "@/components/footer"

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"users" | "processes" | "groups">("users")

  return (
    <div className="flex flex-col min-h-screen">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 p-6 bg-gray-50">
        {activeTab === "users" && <UsersTable />}
        {activeTab === "processes" && <ProcessesTable />}
        {activeTab === "groups" && <GroupsTable />}
      </main>
      <Footer />
    </div>
  )
}

