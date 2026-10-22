import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { User } from './models/User.js';
import { Zone } from './models/Zone.js';
import { Ward } from './models/Ward.js';
import { Area } from './models/Area.js';
import { Department } from './models/Department.js';
import { SystemSetting } from './models/SystemSetting.js';
import { Complaint } from './models/Complaint.js';
import { Announcement } from './models/Announcement.js';

async function seed() {
	if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED_RESET !== 'true') {
		console.error('[seed] Refusing to run destructive seed script in production without ALLOW_SEED_RESET=true.');
		process.exit(1);
	}

	await connectDB();
	console.log('Connected to MongoDB');

	// Clear old complaints and announcements ONLY when explicitly requested via ALLOW_SEED_RESET=true
	if (process.env.ALLOW_SEED_RESET === 'true') {
		const deletedComplaints = await Complaint.deleteMany({});
		console.log(`Reset requested: Deleted ${deletedComplaints.deletedCount} old complaints`);
		
		const deletedAnnouncements = await Announcement.deleteMany({});
		console.log(`Reset requested: Deleted ${deletedAnnouncements.deletedCount} old announcements`);
	}

	const existingAdmin = await User.findOne({ email: 'admin@citicare.local' });
	if (!existingAdmin) {
		const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'admin123';
		await User.create({
			email: 'admin@citicare.local',
			password: adminPassword,
			full_name: 'Admin User',
			role: 'admin',
		});
		console.log('Created initial admin account: admin@citicare.local');
	} else {
		console.log('Admin user already exists');
	}

	await SystemSetting.findOneAndUpdate({ key: 'auto_assign_complaints' }, { value: 'true' }, { upsert: true });
	await SystemSetting.findOneAndUpdate({ key: 'email_confirmations' }, { value: 'false' }, { upsert: true });
	await SystemSetting.findOneAndUpdate({ key: 'maintenance_mode' }, { value: 'false' }, { upsert: true });
	console.log('System settings seeded');

	const zoneData = [
		{ name: 'Central Zone', code: 'CZ' },
		{ name: 'South Zone', code: 'SZ' },
		{ name: 'West Zone', code: 'WZ' },
		{ name: 'East Zone', code: 'EZ' },
		{ name: 'North Zone', code: 'NZ' },
		{ name: 'South-West Zone', code: 'SWZ' },
		{ name: 'South-East Zone', code: 'SEZ' },
	];
	const zoneIds = {};
	for (let i = 0; i < zoneData.length; i++) {
		const z = await Zone.findOneAndUpdate(
			{ code: zoneData[i].code },
			{ name: zoneData[i].name, code: zoneData[i].code },
			{ upsert: true, new: true }
		);
		zoneIds[zoneData[i].code] = z._id;
	}
	console.log('Zones seeded:', zoneData.length);

	const wardData = [
		{ name: 'Nanpura', code: 'W01', zoneCode: 'CZ' },
		{ name: 'Gopipura', code: 'W02', zoneCode: 'CZ' },
		{ name: 'Mahidharpura', code: 'W03', zoneCode: 'CZ' },
		{ name: 'Rander', code: 'W04', zoneCode: 'CZ' },
		{ name: 'Athwa', code: 'W05', zoneCode: 'SZ' },
		{ name: 'Udhna', code: 'W06', zoneCode: 'SZ' },
		{ name: 'Limbayat', code: 'W07', zoneCode: 'SZ' },
		{ name: 'Adajan', code: 'W08', zoneCode: 'WZ' },
		{ name: 'Piplod', code: 'W09', zoneCode: 'WZ' },
		{ name: 'Pal', code: 'W10', zoneCode: 'WZ' },
		{ name: 'Katargam', code: 'W11', zoneCode: 'EZ' },
		{ name: 'Varachha', code: 'W12', zoneCode: 'EZ' },
		{ name: 'Kapodra', code: 'W13', zoneCode: 'EZ' },
		{ name: 'Pandesara', code: 'W14', zoneCode: 'NZ' },
		{ name: 'Sachin', code: 'W15', zoneCode: 'NZ' },
		{ name: 'Vesu', code: 'W16', zoneCode: 'SWZ' },
		{ name: 'Althan', code: 'W17', zoneCode: 'SWZ' },
		{ name: 'Bhatar', code: 'W18', zoneCode: 'SWZ' },
		{ name: 'Dindoli', code: 'W19', zoneCode: 'SEZ' },
		{ name: 'Bhestan', code: 'W20', zoneCode: 'SEZ' },
	];
	const wardIds = {};
	for (const w of wardData) {
		const zoneId = zoneIds[w.zoneCode];
		if (!zoneId) continue;
		const doc = await Ward.findOneAndUpdate(
			{ code: w.code },
			{ name: w.name, code: w.code, zone_id: zoneId },
			{ upsert: true, new: true }
		);
		wardIds[w.code] = doc._id;
	}
	console.log('Wards seeded:', wardData.length);

	const areaData = [
		{ name: 'Nanpura Main Road', code: 'A01', wardCode: 'W01' },
		{ name: 'Ring Road', code: 'A02', wardCode: 'W01' },
		{ name: 'Chowk Bazaar', code: 'A03', wardCode: 'W01' },
		{ name: 'Gopipura Gate', code: 'A04', wardCode: 'W02' },
		{ name: 'Salabatpura', code: 'A05', wardCode: 'W02' },
		{ name: 'Athwa Gate', code: 'A06', wardCode: 'W05' },
		{ name: 'City Light', code: 'A07', wardCode: 'W05' },
		{ name: 'Ghod Dod Road', code: 'A08', wardCode: 'W05' },
		{ name: 'Udhna Darwaja', code: 'A09', wardCode: 'W06' },
		{ name: 'Udhna GIDC', code: 'A10', wardCode: 'W06' },
		{ name: 'Bamroli Road', code: 'A11', wardCode: 'W06' },
		{ name: 'Adajan Patiya', code: 'A12', wardCode: 'W08' },
		{ name: 'Hazira Road', code: 'A13', wardCode: 'W08' },
		{ name: 'Adajan Gam', code: 'A14', wardCode: 'W08' },
		{ name: 'Piplod Crossroad', code: 'A15', wardCode: 'W09' },
		{ name: 'VIP Road', code: 'A16', wardCode: 'W09' },
		{ name: 'Vesu Canal Road', code: 'A17', wardCode: 'W16' },
		{ name: 'Surat-Dumas Road', code: 'A18', wardCode: 'W16' },
		{ name: 'Vesu Circle', code: 'A19', wardCode: 'W16' },
		{ name: 'Katargam Darwaja', code: 'A20', wardCode: 'W11' },
		{ name: 'Amroli', code: 'A21', wardCode: 'W11' },
		{ name: 'Varachha Main Road', code: 'A22', wardCode: 'W12' },
		{ name: 'Nana Varachha', code: 'A23', wardCode: 'W12' },
		{ name: 'Kapodara Cross Road', code: 'A24', wardCode: 'W12' },
		{ name: 'Rander Road', code: 'A25', wardCode: 'W04' },
		{ name: 'Jahangirpura', code: 'A26', wardCode: 'W04' },
		{ name: 'Pal Gam', code: 'A27', wardCode: 'W10' },
		{ name: 'Canal Road', code: 'A28', wardCode: 'W10' },
		{ name: 'Pandesara GIDC', code: 'A29', wardCode: 'W14' },
		{ name: 'Ved Road', code: 'A30', wardCode: 'W14' },
	];
	for (const a of areaData) {
		const wardId = wardIds[a.wardCode];
		if (!wardId) continue;
		await Area.findOneAndUpdate(
			{ code: a.code },
			{ name: a.name, code: a.code, ward_id: wardId },
			{ upsert: true }
		);
	}
	console.log('Areas seeded:', areaData.length);

	const deptDefs = [
		{ code: 'ROADS', name: 'Roads & Potholes', description: 'Road maintenance and potholes', category: 'roads' },
		{ code: 'WATER', name: 'Water Supply', description: 'Water supply issues', category: 'water' },
		{ code: 'ELECTRIC', name: 'Electricity', description: 'Electricity and streetlights', category: 'electricity' },
		{ code: 'GARBAGE', name: 'Solid Waste Management', description: 'Garbage collection and waste', category: 'garbage' },
		{ code: 'SEWAGE', name: 'Sewage & Drainage', description: 'Sewage and drainage issues', category: 'sewage' },
		{ code: 'LIGHTS', name: 'Street Lights', description: 'Street light maintenance', category: 'street_lights' },
		{ code: 'PARKS', name: 'Parks & Gardens', description: 'Parks and green spaces', category: 'parks' },
		{ code: 'OTHER', name: 'General Issues', description: 'Other miscellaneous issues', category: 'other' },
	];

	const deptMap = {};
	for (const dept of deptDefs) {
		const d = await Department.findOneAndUpdate(
			{ code: dept.code },
			{ name: dept.name, code: dept.code, description: dept.description, category: dept.category },
			{ upsert: true, new: true }
		);
		deptMap[dept.code] = d._id;
	}
	console.log('Departments created');

	const defaultHeads = {
		ROADS: { email: 'roads@citicare.local', name: 'Rajesh Kumar' },
		WATER: { email: 'water@citicare.local', name: 'Priya Patel' },
		ELECTRIC: { email: 'electricity@citicare.local', name: 'Vikram Singh' },
		GARBAGE: { email: 'garbage@citicare.local', name: 'Anjali Sharma' },
		SEWAGE: { email: 'sewage@citicare.local', name: 'Mehul Desai' },
		LIGHTS: { email: 'lights@citicare.local', name: 'Rohit Gupta' },
		PARKS: { email: 'parks@citicare.local', name: 'Neha Mishra' },
		OTHER: { email: 'other@citicare.local', name: 'Arun Verma' },
	};

	const allDepartments = await Department.find({});
	let linkedHeads = 0;

	for (const dept of allDepartments) {
		const preset = defaultHeads[dept.code];
		const fallbackKey = (dept.code || dept.name || 'department')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');

		const officerEmail = preset?.email || `${fallbackKey}@citicare.local`;
		const officerName = preset?.name || `${dept.name} In-Charge`;

		let officer = await User.findOne({ email: officerEmail });
		if (!officer) {
			const officerPassword = process.env.INITIAL_OFFICER_PASSWORD || 'officer123';
			officer = await User.create({
				email: officerEmail,
				password: officerPassword,
				full_name: officerName,
				role: 'department_head',
				department_id: dept._id,
			});
			console.log(`Created department head for ${dept.name}: ${officerEmail}`);
		}

		await Department.findByIdAndUpdate(dept._id, { in_charge_officer_id: officer._id });
		linkedHeads += 1;
	}

	console.log(`Department in-charge officers ensured for departments: ${linkedHeads}`);

	const defaultContractors = {
		ROADS: [
			{ name: 'Ramesh Patel (Surat Roadways)', email: 'roads.contractor1@citicare.local', phone: '+91 98250 11001', company: 'Surat Roadways Infra' },
			{ name: 'Kishore Dave (Apex Paving)', email: 'roads.contractor2@citicare.local', phone: '+91 98250 11002', company: 'Apex Paving Works' },
		],
		WATER: [
			{ name: 'Bhavin Shah (AquaFlow Solutions)', email: 'water.contractor1@citicare.local', phone: '+91 98250 22001', company: 'AquaFlow Pipeline Solutions' },
			{ name: 'Sanjay Mehta (Blue River Utilities)', email: 'water.contractor2@citicare.local', phone: '+91 98250 22002', company: 'Blue River Utilities' },
		],
		ELECTRIC: [
			{ name: 'Dinesh Joshi (Gujarat PowerGrid)', email: 'electricity.contractor1@citicare.local', phone: '+91 98250 33001', company: 'Gujarat PowerGrid Works' },
			{ name: 'Naveen Solanki (BrightVolt)', email: 'electricity.contractor2@citicare.local', phone: '+91 98250 33002', company: 'BrightVolt Electricals' },
		],
		GARBAGE: [
			{ name: 'Mukesh Yadav (CleanCity Fleet)', email: 'garbage.contractor1@citicare.local', phone: '+91 98250 44001', company: 'CleanCity Sanitation Fleet' },
			{ name: 'Kamlesh Rana (GreenEarth Waste)', email: 'garbage.contractor2@citicare.local', phone: '+91 98250 44002', company: 'GreenEarth Waste Handling' },
		],
		SEWAGE: [
			{ name: 'Pravin Gohil (Surat Drainage)', email: 'sewage.contractor1@citicare.local', phone: '+91 98250 55001', company: 'Surat Drainage Specialists' },
			{ name: 'Ashok Varma (DeepFlow Civil)', email: 'sewage.contractor2@citicare.local', phone: '+91 98250 55002', company: 'DeepFlow Civil Works' },
		],
		LIGHTS: [
			{ name: 'Sunil Rao (Lumina Lighting)', email: 'lights.contractor1@citicare.local', phone: '+91 98250 66001', company: 'Lumina Urban Lighting' },
			{ name: 'Gaurav Kulkarni (RayBeam Lights)', email: 'lights.contractor2@citicare.local', phone: '+91 98250 66002', company: 'RayBeam Municipal Lights' },
		],
		PARKS: [
			{ name: 'Haresh Trivedi (GreenVistas)', email: 'parks.contractor1@citicare.local', phone: '+91 98250 77001', company: 'GreenVistas Landscaping' },
			{ name: 'Chetan Prajapati (FloraCare)', email: 'parks.contractor2@citicare.local', phone: '+91 98250 77002', company: 'FloraCare Horticulture' },
		],
		OTHER: [
			{ name: 'Manoj Chauhan (Universal Repairs)', email: 'other.contractor1@citicare.local', phone: '+91 98250 88001', company: 'Universal Civic Repairs' },
			{ name: 'Deepak Parmar (SwiftAction)', email: 'other.contractor2@citicare.local', phone: '+91 98250 88002', company: 'SwiftAction Maintenance' },
		],
	};

	let seededContractors = 0;
	const contractorPassword = process.env.INITIAL_CONTRACTOR_PASSWORD || 'contractor123';

	for (const dept of allDepartments) {
		const list = defaultContractors[dept.code] || [
			{
				name: `${dept.name} Contractor A`,
				email: `${dept.code.toLowerCase()}.contractor1@citicare.local`,
				phone: '+91 98250 99001',
				company: `${dept.name} Prime Contractor`,
			},
			{
				name: `${dept.name} Contractor B`,
				email: `${dept.code.toLowerCase()}.contractor2@citicare.local`,
				phone: '+91 98250 99002',
				company: `${dept.name} Allied Services`,
			},
		];

		for (const c of list) {
			let contractorUser = await User.findOne({ email: c.email });
			if (!contractorUser) {
				await User.create({
					email: c.email,
					password: contractorPassword,
					full_name: c.name,
					role: 'contractor',
					phone: c.phone,
					department_id: dept._id,
					availability: 'available',
					contractor_company: c.company,
				});
				seededContractors += 1;
			}
		}
	}
	console.log(`Contractors ensured (2 per department, total newly added: ${seededContractors})`);

	await mongoose.disconnect();
	console.log('Seed complete');
}

seed().catch((e) => {
	console.error(e);
	process.exit(1);
});
