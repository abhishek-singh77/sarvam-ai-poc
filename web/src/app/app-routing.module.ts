import { Routes } from '@angular/router'
import { HomeComponent } from './components/home/home.component'
import { KYCComponent } from './components/kyc/kyc.component'

export const routes: Routes = [
    { path: '', redirectTo: '/home', pathMatch: 'full' },
    { path: 'home', component: HomeComponent },
    { path: 'kyc', component: KYCComponent },
    { path: '**', redirectTo: '/home' },
]
