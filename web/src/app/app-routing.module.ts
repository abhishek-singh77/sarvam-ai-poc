import { Routes } from '@angular/router'
import { HomeComponent } from './components/home/home.component'
import { KYCComponent } from './components/kyc/kyc.component'
import { EnhancedKYCComponent } from './components/enhanced-kyc/enhanced-kyc.component'

export const routes: Routes = [
    { path: '', redirectTo: '/home', pathMatch: 'full' },
    { path: 'home', component: HomeComponent },
    { path: 'kyc', component: KYCComponent },
    { path: 'enhanced-kyc', component: EnhancedKYCComponent },
    { path: '**', redirectTo: '/home' },
]
